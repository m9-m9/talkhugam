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

  return v_post_id;
end;
$$;

create or replace function public.create_reply(
  p_root_post_id uuid,
  p_client_id uuid,
  p_body text,
  p_mentioned_member_ids uuid[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_root public.posts%rowtype;
  v_chat public.book_chats%rowtype;
  v_member public.room_members%rowtype;
  v_root_author_profile_id uuid;
  v_reply_id uuid;
  v_body text := nullif(btrim(p_body), '');
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  select *
  into v_root
  from public.posts
  where id = p_root_post_id
    and depth = 0
    and deleted_at is null;

  if v_root.id is null then
    raise exception using errcode = 'P0001', message = 'POST_NOT_FOUND';
  end if;

  select *
  into v_chat
  from public.book_chats
  where id = v_root.book_chat_id
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
  into v_reply_id
  from public.posts
  where author_member_id = v_member.id
    and client_id = p_client_id;

  if v_reply_id is not null then
    return v_reply_id;
  end if;

  if p_client_id is null or v_body is null or char_length(v_body) > 500 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  insert into public.posts (
    book_chat_id,
    author_member_id,
    type,
    body,
    parent_post_id,
    root_post_id,
    depth,
    client_id,
    author_name_snapshot,
    author_avatar_snapshot
  )
  values (
    v_chat.id,
    v_member.id,
    'text',
    v_body,
    v_root.id,
    v_root.id,
    1,
    p_client_id,
    v_member.room_display_name,
    v_member.room_avatar_path
  )
  on conflict (author_member_id, client_id)
    where author_member_id is not null
    do nothing
  returning id into v_reply_id;

  if v_reply_id is null then
    select id
    into v_reply_id
    from public.posts
    where author_member_id = v_member.id
      and client_id = p_client_id;

    return v_reply_id;
  end if;

  select profile_id
  into v_root_author_profile_id
  from public.room_members
  where id = v_root.author_member_id
    and status = 'active';

  perform private.enqueue_notification(
    v_root_author_profile_id,
    'reply',
    v_member.id,
    v_chat.room_id,
    v_reply_id
  );

  perform private.attach_post_mentions(
    v_reply_id,
    v_chat.room_id,
    v_member.id,
    p_mentioned_member_ids,
    v_root_author_profile_id
  );

  return v_reply_id;
end;
$$;

revoke all on function public.create_post(
  uuid, uuid, public.post_type, text, jsonb, uuid[]
) from public, anon;
revoke all on function public.create_reply(uuid, uuid, text, uuid[])
from public, anon;

grant execute on function public.create_post(
  uuid, uuid, public.post_type, text, jsonb, uuid[]
) to authenticated;
grant execute on function public.create_reply(uuid, uuid, text, uuid[])
to authenticated;

comment on function public.create_post(uuid, uuid, public.post_type, text, jsonb, uuid[])
is 'Atomically creates an idempotent root post with labels, mentions, and notifications';
comment on function public.create_reply(uuid, uuid, text, uuid[])
is 'Atomically creates an idempotent Phase 1 root reply with deduplicated notifications';
