alter table public.notifications
add column if not exists book_chat_id uuid references public.book_chats (id) on delete cascade;

create index if not exists notifications_book_chat_id_idx
on public.notifications (book_chat_id)
where book_chat_id is not null;

create or replace function private.enqueue_notification(
  p_recipient_profile_id uuid,
  p_type public.notification_type,
  p_actor_member_id uuid default null,
  p_room_id uuid default null,
  p_post_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_notification_id uuid;
  v_preferences public.notification_preferences%rowtype;
  v_book_chat_id uuid;
begin
  if p_recipient_profile_id is null then
    return null;
  end if;

  if exists (
    select 1
    from public.room_members
    where id = p_actor_member_id
      and profile_id = p_recipient_profile_id
  ) then
    return null;
  end if;

  select *
  into v_preferences
  from public.notification_preferences
  where profile_id = p_recipient_profile_id;

  if p_type = 'reply' and not coalesce(v_preferences.replies_enabled, true) then
    return null;
  end if;

  if p_type = 'mention' and not coalesce(v_preferences.mentions_enabled, true) then
    return null;
  end if;

  if p_type in ('invite', 'removed', 'ownership_transfer')
    and not coalesce(v_preferences.room_events_enabled, true)
  then
    return null;
  end if;

  select book_chat_id
  into v_book_chat_id
  from public.posts
  where id = p_post_id;

  insert into public.notifications (
    recipient_profile_id,
    actor_member_id,
    room_id,
    post_id,
    book_chat_id,
    type
  )
  values (
    p_recipient_profile_id,
    p_actor_member_id,
    p_room_id,
    p_post_id,
    v_book_chat_id,
    p_type
  )
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;

create or replace function private.enqueue_book_chat_activity_notifications(
  p_book_chat_id uuid,
  p_type public.notification_type,
  p_actor_member_id uuid,
  p_post_id uuid default null,
  p_excluded_member_ids uuid[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_room_id uuid;
  v_excluded_member_ids uuid[] := coalesce(p_excluded_member_ids, '{}');
begin
  if p_type not in ('post', 'video', 'completion') then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  select room_id
  into v_room_id
  from public.book_chats
  where id = p_book_chat_id
    and deleted_at is null;

  if v_room_id is null then
    raise exception using errcode = 'P0001', message = 'BOOK_CHAT_NOT_FOUND';
  end if;

  insert into public.notifications (
    recipient_profile_id,
    actor_member_id,
    room_id,
    post_id,
    book_chat_id,
    type
  )
  select
    member.profile_id,
    p_actor_member_id,
    v_room_id,
    p_post_id,
    p_book_chat_id,
    p_type
  from public.room_members as member
  left join public.notification_preferences as preferences
    on preferences.profile_id = member.profile_id
  where member.room_id = v_room_id
    and member.status = 'active'
    and member.profile_id is not null
    and member.id <> p_actor_member_id
    and member.id <> all(v_excluded_member_ids)
    and coalesce(preferences.room_events_enabled, true);
end;
$$;

create or replace function public.create_post(
  p_book_chat_id uuid,
  p_client_id uuid,
  p_type public.post_type,
  p_body text default null,
  p_labels jsonb default '[]'::jsonb,
  p_mentioned_member_ids uuid[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_chat public.book_chats%rowtype;
  v_member public.room_members%rowtype;
  v_post_id uuid;
  v_body text := nullif(btrim(p_body), '');
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  select *
  into v_chat
  from public.book_chats
  where id = p_book_chat_id
    and deleted_at is null;

  if v_chat.id is null then
    raise exception using errcode = 'P0001', message = 'BOOK_CHAT_NOT_FOUND';
  end if;

  if v_chat.status = 'archived' then
    raise exception using errcode = 'P0001', message = 'BOOK_CHAT_ARCHIVED';
  end if;

  select *
  into v_member
  from public.room_members
  where room_id = v_chat.room_id
    and profile_id = auth.uid()
    and status = 'active';

  if v_member.id is null then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  select id
  into v_post_id
  from public.posts
  where author_member_id = v_member.id
    and client_id = p_client_id;

  if v_post_id is not null then
    return v_post_id;
  end if;

  if p_client_id is null
    or p_type is null
    or (p_body is not null and v_body is null)
  then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  if v_body is not null and char_length(v_body) > 500 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  if p_type = 'text'
    and v_body is null
    and coalesce(p_labels, '[]'::jsonb) = '[]'::jsonb
  then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  insert into public.posts (
    book_chat_id,
    author_member_id,
    type,
    body,
    client_id,
    author_name_snapshot,
    author_avatar_snapshot
  )
  values (
    v_chat.id,
    v_member.id,
    p_type,
    v_body,
    p_client_id,
    v_member.room_display_name,
    v_member.room_avatar_path
  )
  on conflict (author_member_id, client_id)
    where author_member_id is not null
    do nothing
  returning id into v_post_id;

  if v_post_id is null then
    select id
    into v_post_id
    from public.posts
    where author_member_id = v_member.id
      and client_id = p_client_id;

    return v_post_id;
  end if;

  perform private.attach_post_labels(v_post_id, p_labels);
  perform private.attach_post_mentions(
    v_post_id,
    v_chat.room_id,
    v_member.id,
    p_mentioned_member_ids,
    null
  );

  if p_type = 'text' then
    perform private.enqueue_book_chat_activity_notifications(
      v_chat.id,
      'post',
      v_member.id,
      v_post_id,
      p_mentioned_member_ids
    );
  end if;

  return v_post_id;
end;
$$;

create or replace function public.apply_mux_video_event(
  p_event_id text,
  p_event_type text,
  p_post_id uuid,
  p_status public.video_status,
  p_object_id text default null,
  p_mux_asset_id text default null,
  p_playback_id text default null,
  p_duration_seconds numeric default null,
  p_aspect_ratio text default null,
  p_error_code text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_event_id text;
  v_asset public.video_assets%rowtype;
  v_actor_member_id uuid;
  v_book_chat_id uuid;
  v_ready_count integer := 0;
begin
  if char_length(btrim(p_event_id)) not between 1 and 200
    or char_length(btrim(p_event_type)) not between 1 and 200
    or p_post_id is null
    or p_status is null
  then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  if p_status in ('processing', 'ready')
    and nullif(btrim(p_mux_asset_id), '') is null
  then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  if p_status = 'ready'
    and (
      p_duration_seconds is null
      or p_duration_seconds < 0
      or nullif(btrim(p_playback_id), '') is null
    )
  then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  insert into public.mux_events (event_id, event_type, object_id)
  values (btrim(p_event_id), btrim(p_event_type), nullif(btrim(p_object_id), ''))
  on conflict (event_id) do nothing
  returning event_id into v_event_id;

  if v_event_id is null then
    return false;
  end if;

  select *
  into v_asset
  from public.video_assets
  where post_id = p_post_id
  for update;

  if v_asset.post_id is null then
    raise exception using errcode = 'P0001', message = 'POST_NOT_FOUND';
  end if;

  if p_status = 'processing' and v_asset.status = 'waiting_upload' then
    update public.video_assets
    set
      status = 'processing',
      mux_asset_id = coalesce(nullif(btrim(p_mux_asset_id), ''), mux_asset_id),
      aspect_ratio = coalesce(nullif(btrim(p_aspect_ratio), ''), aspect_ratio)
    where post_id = p_post_id;
  end if;

  if p_status = 'ready'
    and v_asset.status in ('waiting_upload', 'processing')
    and p_duration_seconds > 30
  then
    update public.video_assets
    set
      status = 'failed',
      mux_asset_id = coalesce(nullif(btrim(p_mux_asset_id), ''), mux_asset_id),
      duration_seconds = p_duration_seconds,
      error_code = 'VIDEO_TOO_LONG'
    where post_id = p_post_id;

    perform private.enqueue_deletion_job('post', p_post_id, 'mux');
  end if;

  if p_status = 'ready'
    and v_asset.status in ('waiting_upload', 'processing')
    and p_duration_seconds between 0 and 30
  then
    update public.video_assets
    set
      status = 'ready',
      mux_asset_id = coalesce(nullif(btrim(p_mux_asset_id), ''), mux_asset_id),
      playback_id = nullif(btrim(p_playback_id), ''),
      duration_seconds = p_duration_seconds,
      aspect_ratio = nullif(btrim(p_aspect_ratio), ''),
      error_code = null,
      ready_at = now()
    where post_id = p_post_id;

    get diagnostics v_ready_count = row_count;
  end if;

  if p_status = 'failed' and v_asset.status in ('waiting_upload', 'processing') then
    update public.video_assets
    set
      status = 'failed',
      mux_asset_id = coalesce(nullif(btrim(p_mux_asset_id), ''), mux_asset_id),
      error_code = coalesce(nullif(btrim(p_error_code), ''), 'VIDEO_PROCESSING_FAILED')
    where post_id = p_post_id;
  end if;

  if p_status = 'deleted' and v_asset.status <> 'deleted' then
    update public.video_assets
    set status = 'deleted', deleted_at = now()
    where post_id = p_post_id;
  end if;

  if v_ready_count = 1 then
    select book_chat_id, author_member_id
    into v_book_chat_id, v_actor_member_id
    from public.posts
    where id = p_post_id;

    perform private.enqueue_book_chat_activity_notifications(
      v_book_chat_id,
      'video',
      v_actor_member_id,
      p_post_id
    );
  end if;

  update public.mux_events
  set status = 'processed', processed_at = now()
  where event_id = v_event_id;

  return true;
end;
$$;

create or replace function public.upsert_book_chat_completion(
  p_book_chat_id uuid,
  p_rating smallint default null,
  p_review text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_chat public.book_chats%rowtype;
  v_actor_member_id uuid;
  v_completion_id uuid;
  v_review text := nullif(btrim(p_review), '');
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  select *
  into v_chat
  from public.book_chats
  where id = p_book_chat_id
    and deleted_at is null
  for update;

  if v_chat.id is null then
    raise exception using errcode = 'P0001', message = 'BOOK_CHAT_NOT_FOUND';
  end if;

  select id
  into v_actor_member_id
  from public.room_members
  where room_id = v_chat.room_id
    and profile_id = auth.uid()
    and status = 'active';

  if v_actor_member_id is null then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  if p_rating is not null and p_rating not between 1 and 5 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  if v_review is not null and char_length(v_review) > 1000 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  insert into public.book_chat_completions (
    book_chat_id,
    profile_id,
    rating,
    review
  )
  values (
    p_book_chat_id,
    auth.uid(),
    p_rating,
    v_review
  )
  on conflict (book_chat_id, profile_id) do nothing
  returning id into v_completion_id;

  if v_completion_id is null then
    update public.book_chat_completions
    set
      rating = p_rating,
      review = v_review,
      updated_at = now()
    where book_chat_id = p_book_chat_id
      and profile_id = auth.uid();

    return;
  end if;

  perform private.enqueue_book_chat_activity_notifications(
    p_book_chat_id,
    'completion',
    v_actor_member_id
  );
end;
$$;

revoke all on function private.enqueue_book_chat_activity_notifications(
  uuid, public.notification_type, uuid, uuid, uuid[]
) from public, anon, authenticated;

comment on column public.notifications.book_chat_id is
  '알림이 연결하는 책 대화를 보관해 삭제되지 않은 활동의 화면 이동 경로를 만든다.';
comment on function private.enqueue_notification(uuid, public.notification_type, uuid, uuid, uuid) is
  '수신 설정과 자기 알림을 확인해 기존 알림을 등록하고 게시물의 책 대화 연결을 보관한다.';
comment on function private.enqueue_book_chat_activity_notifications(uuid, public.notification_type, uuid, uuid, uuid[]) is
  '책방의 활성 멤버에게 중복 제외 조건과 책방 알림 설정을 적용해 책 활동 알림을 등록한다.';
comment on function public.create_post(uuid, uuid, public.post_type, text, jsonb, uuid[]) is
  '활성 책방 멤버의 루트 독후감을 중복 없이 만들고 멘션 및 일반 책 활동 알림을 등록한다.';
comment on function public.apply_mux_video_event(text, text, uuid, public.video_status, text, text, text, numeric, text, text) is
  '서명이 검증된 Mux 이벤트를 한 번만 반영하고 최초 영상 준비 완료 시 책방 멤버에게 알린다.';
comment on function public.upsert_book_chat_completion(uuid, smallint, text) is
  '활성 책방 멤버의 개인 완독 기록을 저장하고 최초 완독일 때만 책방 멤버에게 알린다.';
