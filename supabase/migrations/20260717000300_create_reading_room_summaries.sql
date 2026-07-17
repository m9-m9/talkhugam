create or replace function public.get_my_reading_room_summaries()
returns table (
  id uuid,
  name varchar,
  description varchar,
  created_at timestamptz,
  updated_at timestamptz,
  last_message_author_name varchar,
  last_message_body varchar,
  last_message_created_at timestamptz,
  last_message_type text
)
language sql
stable
security invoker
set search_path = pg_catalog, public, private
as $$
  select
    room.id,
    room.name,
    room.description,
    room.created_at,
    room.updated_at,
    latest_post.author_name_snapshot,
    latest_post.body,
    latest_post.created_at,
    latest_post.type::text
  from public.reading_rooms as room
  join public.room_members as current_member
    on current_member.room_id = room.id
    and current_member.profile_id = auth.uid()
    and current_member.status = 'active'
  left join lateral (
    select
      post.author_name_snapshot,
      post.body,
      post.created_at,
      post.type
    from public.book_chats as chat
    join public.posts as post on post.book_chat_id = chat.id
    where chat.room_id = room.id
      and chat.deleted_at is null
      and post.deleted_at is null
    order by post.created_at desc, post.id desc
    limit 1
  ) as latest_post on true
  where room.status = 'active'
    and room.deleted_at is null
  order by coalesce(latest_post.created_at, room.updated_at, room.created_at) desc, room.id;
$$;

revoke all on function public.get_my_reading_room_summaries() from public, anon;
grant execute on function public.get_my_reading_room_summaries() to authenticated;

comment on function public.get_my_reading_room_summaries()
is 'Returns active reading rooms ordered by the latest incoming or outgoing message.';
