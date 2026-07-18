alter table public.notifications
add column book_chat_id uuid references public.book_chats (id) on delete cascade;

create index notifications_book_chat_id_idx
on public.notifications (book_chat_id)
where book_chat_id is not null;

create or replace function private.enqueue_book_activity_notifications(
  p_room_id uuid,
  p_book_chat_id uuid,
  p_actor_member_id uuid,
  p_type public.notification_type
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  insert into public.notifications (
    recipient_profile_id,
    actor_member_id,
    room_id,
    book_chat_id,
    type
  )
  select
    room_member.profile_id,
    p_actor_member_id,
    p_room_id,
    p_book_chat_id,
    p_type
  from public.room_members as room_member
  left join public.room_members as actor_member
    on actor_member.id = p_actor_member_id
  left join public.notification_preferences as preferences
    on preferences.profile_id = room_member.profile_id
  where room_member.room_id = p_room_id
    and room_member.status = 'active'
    and room_member.profile_id is distinct from actor_member.profile_id
    and coalesce(preferences.room_events_enabled, true);
end;
$$;

create or replace function private.notify_ready_video()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_book_chat_id uuid;
  v_room_id uuid;
  v_author_member_id uuid;
begin
  if new.status <> 'ready' or old.status = 'ready' then
    return new;
  end if;

  select post.book_chat_id, book_chat.room_id, post.author_member_id
  into v_book_chat_id, v_room_id, v_author_member_id
  from public.posts as post
  join public.book_chats as book_chat on book_chat.id = post.book_chat_id
  where post.id = new.post_id;

  if v_room_id is not null then
    perform private.enqueue_book_activity_notifications(
      v_room_id,
      v_book_chat_id,
      v_author_member_id,
      'video_ready'
    );
  end if;

  return new;
end;
$$;

create trigger video_assets_notify_ready
after update of status on public.video_assets
for each row execute function private.notify_ready_video();

create or replace function private.notify_completion_review()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_room_id uuid;
  v_actor_member_id uuid;
begin
  if new.review is null
    or (tg_op = 'UPDATE' and old.review is not null) then
    return new;
  end if;

  select book_chat.room_id, room_member.id
  into v_room_id, v_actor_member_id
  from public.book_chats as book_chat
  join public.room_members as room_member
    on room_member.room_id = book_chat.room_id
   and room_member.profile_id = new.profile_id
  where book_chat.id = new.book_chat_id
    and room_member.status = 'active';

  if v_room_id is not null then
    perform private.enqueue_book_activity_notifications(
      v_room_id,
      new.book_chat_id,
      v_actor_member_id,
      'completion_review'
    );
  end if;

  return new;
end;
$$;

create trigger book_chat_completions_notify_review
after insert or update of review on public.book_chat_completions
for each row execute function private.notify_completion_review();

revoke all on function private.enqueue_book_activity_notifications(
  uuid, uuid, uuid, public.notification_type
) from public, anon, authenticated;
revoke all on function private.notify_ready_video() from public, anon, authenticated;
revoke all on function private.notify_completion_review() from public, anon, authenticated;

comment on function private.enqueue_book_activity_notifications(uuid, uuid, uuid, public.notification_type) is
  '활성 책방 멤버에게 영상 준비 완료 또는 완독 총평 알림을 환경 설정에 맞게 만든다.';
comment on function private.notify_ready_video() is
  '영상 상태가 ready로 최초 전환될 때 같은 책방 멤버에게 영상 기록 알림을 만든다.';
comment on function private.notify_completion_review() is
  '개인 완독 총평이 처음 저장될 때 같은 책방 멤버에게 총평 알림을 만든다.';
