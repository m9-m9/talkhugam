create or replace function private.validate_post_references()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_room_id uuid;
  v_root_book_chat_id uuid;
  v_root_depth smallint;
begin
  select room_id
  into v_room_id
  from public.book_chats
  where id = new.book_chat_id
    and deleted_at is null;

  if v_room_id is null then
    raise exception using errcode = 'P0001', message = 'BOOK_CHAT_NOT_FOUND';
  end if;

  if new.author_member_id is not null and not exists (
    select 1
    from public.room_members
    where id = new.author_member_id
      and room_id = v_room_id
      and status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  if new.depth = 0 then
    return new;
  end if;

  select book_chat_id, depth
  into v_root_book_chat_id, v_root_depth
  from public.posts
  where id = new.root_post_id
    and deleted_at is null;

  if v_root_book_chat_id is null then
    raise exception using errcode = 'P0001', message = 'POST_NOT_FOUND';
  end if;

  if v_root_depth <> 0 or v_root_book_chat_id <> new.book_chat_id then
    raise exception using errcode = 'P0001', message = 'POST_CROSS_THREAD_REPLY';
  end if;

  return new;
end;
$$;

create trigger posts_validate_references
before insert or update of book_chat_id, author_member_id, parent_post_id, root_post_id, depth
on public.posts
for each row execute function private.validate_post_references();

create or replace function private.validate_post_mention()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if not exists (
    select 1
    from public.posts as post
    join public.book_chats as chat on chat.id = post.book_chat_id
    join public.room_members as member
      on member.id = new.mentioned_member_id
      and member.room_id = chat.room_id
    where post.id = new.post_id
      and post.deleted_at is null
      and chat.deleted_at is null
      and member.status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'MENTION_MEMBER_INVALID';
  end if;

  return new;
end;
$$;

create trigger post_mentions_validate_member
before insert or update on public.post_mentions
for each row execute function private.validate_post_mention();

create or replace function private.can_access_post(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select exists (
    select 1
    from public.posts
    where id = p_post_id
      and private.can_access_book_chat(book_chat_id)
  );
$$;

revoke all on function private.validate_post_references() from public, anon, authenticated;
revoke all on function private.validate_post_mention() from public, anon, authenticated;
revoke all on function private.can_access_post(uuid) from public, anon;
grant execute on function private.can_access_post(uuid) to authenticated;

alter table public.posts enable row level security;
alter table public.post_labels enable row level security;
alter table public.post_mentions enable row level security;

revoke all on table public.posts from anon, authenticated;
revoke all on table public.post_labels from anon, authenticated;
revoke all on table public.post_mentions from anon, authenticated;

grant select on table public.posts to authenticated;
grant select on table public.post_labels to authenticated;
grant select on table public.post_mentions to authenticated;

create policy posts_select_active_room_member
on public.posts
for select
to authenticated
using (private.can_access_book_chat(book_chat_id));

create policy post_labels_select_active_room_member
on public.post_labels
for select
to authenticated
using (private.can_access_post(post_id));

create policy post_mentions_select_active_room_member
on public.post_mentions
for select
to authenticated
using (private.can_access_post(post_id));

comment on function private.validate_post_references() is 'Enforces active authors and Phase 1 same-chat root reply integrity';
comment on function private.validate_post_mention() is 'Rejects mentions outside the post room or of inactive members';
comment on function private.can_access_post(uuid) is 'Returns true when the current user can access the post parent book chat';
