create type public.account_deletion_mode as enum ('anonymize', 'delete_content');
create type public.account_deletion_status as enum ('prepared', 'auth_deleted', 'failed');

create table private.account_deletion_requests (
  id uuid primary key,
  profile_id uuid not null unique,
  mode public.account_deletion_mode not null,
  status public.account_deletion_status not null default 'prepared',
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_deletion_status_shape
    check (
      (status in ('prepared', 'auth_deleted') and last_error is null)
      or (status = 'failed' and last_error is not null)
    )
);

create trigger account_deletion_requests_set_updated_at
before update on private.account_deletion_requests
for each row execute function private.set_updated_at();

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

  if tg_op = 'UPDATE'
    and new.book_chat_id is not distinct from old.book_chat_id
    and new.parent_post_id is not distinct from old.parent_post_id
    and new.root_post_id is not distinct from old.root_post_id
    and new.depth is not distinct from old.depth
  then
    return new;
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

create or replace function public.prepare_account_deletion(
  p_mode public.account_deletion_mode,
  p_request_id uuid
)
returns table (request_id uuid, profile_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_profile_id uuid := auth.uid();
  v_existing private.account_deletion_requests%rowtype;
  v_member_ids uuid[];
  v_owned_room_ids uuid[];
begin
  if v_profile_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  if p_mode is null or p_request_id is null then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  select *
  into v_existing
  from private.account_deletion_requests
  where account_deletion_requests.profile_id = v_profile_id
  for update;

  if v_existing.id is not null then
    if v_existing.mode <> p_mode then
      raise exception using errcode = 'P0001', message = 'CONFLICT';
    end if;

    update private.account_deletion_requests
    set status = 'prepared', last_error = null
    where id = v_existing.id and status = 'failed';

    return query select v_existing.id, v_existing.profile_id;
    return;
  end if;

  if not exists (select 1 from public.profiles where id = v_profile_id) then
    raise exception using errcode = 'P0001', message = 'PROFILE_REQUIRED';
  end if;

  if exists (
    select 1
    from public.room_members as owner
    where owner.profile_id = v_profile_id
      and owner.role = 'owner'
      and owner.status = 'active'
      and (
        select count(*)
        from public.room_members as active_member
        where active_member.room_id = owner.room_id
          and active_member.status = 'active'
      ) > 1
  ) then
    raise exception using errcode = 'P0001', message = 'OWNER_TRANSFER_REQUIRED';
  end if;

  insert into private.account_deletion_requests (id, profile_id, mode)
  values (p_request_id, v_profile_id, p_mode);

  select coalesce(array_agg(id), '{}')
  into v_member_ids
  from public.room_members
  where room_members.profile_id = v_profile_id;

  select coalesce(array_agg(owner.room_id), '{}')
  into v_owned_room_ids
  from public.room_members as owner
  where owner.profile_id = v_profile_id
    and owner.role = 'owner'
    and owner.status = 'active';

  perform private.enqueue_deletion_job('room', room_id, 'mux')
  from unnest(v_owned_room_ids) as owned_room(room_id);

  update public.reading_rooms
  set status = 'deleted', deleted_at = now(), archived_at = null
  where id = any(v_owned_room_ids)
    and status <> 'deleted';

  if p_mode = 'delete_content' then
    perform private.enqueue_deletion_job('post', post.id, 'mux')
    from public.posts as post
    join public.video_assets as asset on asset.post_id = post.id
    where post.author_member_id = any(v_member_ids)
      and asset.status <> 'deleted';

    delete from public.post_labels
    where post_id in (
      select id from public.posts where author_member_id = any(v_member_ids)
    );

    delete from public.post_mentions
    where post_id in (
      select id from public.posts where author_member_id = any(v_member_ids)
    )
      or mentioned_member_id = any(v_member_ids);

    update public.posts
    set
      author_member_id = null,
      author_name_snapshot = '탈퇴한 사용자',
      author_avatar_snapshot = null,
      body = null,
      deleted_at = coalesce(deleted_at, now())
    where author_member_id = any(v_member_ids);
  else
    delete from public.post_mentions
    where mentioned_member_id = any(v_member_ids);

    update public.posts
    set
      author_member_id = null,
      author_name_snapshot = '탈퇴한 사용자',
      author_avatar_snapshot = null
    where author_member_id = any(v_member_ids);
  end if;

  update public.notifications
  set actor_member_id = null
  where actor_member_id = any(v_member_ids);

  update public.room_members
  set
    profile_id = null,
    role = 'member',
    status = 'left',
    room_display_name = '탈퇴한 사용자',
    room_avatar_path = null,
    left_at = coalesce(left_at, now())
  where id = any(v_member_ids);

  return query select p_request_id, v_profile_id;
end;
$$;

create or replace function public.finish_account_deletion(
  p_request_id uuid,
  p_succeeded boolean,
  p_last_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  update private.account_deletion_requests
  set
    status = case
      when p_succeeded then 'auth_deleted'::public.account_deletion_status
      else 'failed'::public.account_deletion_status
    end,
    last_error = case
      when p_succeeded then null
      else coalesce(nullif(btrim(p_last_error), ''), 'AUTH_DELETE_FAILED')
    end
  where id = p_request_id;

  return found;
end;
$$;

revoke all on table private.account_deletion_requests from public, anon, authenticated;
revoke all on function public.prepare_account_deletion(public.account_deletion_mode, uuid)
from public, anon;
revoke all on function public.finish_account_deletion(uuid, boolean, text)
from public, anon, authenticated;

grant execute on function public.prepare_account_deletion(public.account_deletion_mode, uuid)
to authenticated;
grant execute on function public.finish_account_deletion(uuid, boolean, text)
to service_role;

comment on table private.account_deletion_requests is 'Idempotent handoff between the database deletion transaction and Auth admin deletion';
comment on function public.prepare_account_deletion(public.account_deletion_mode, uuid)
is 'Validates ownership and atomically anonymizes or tombstones account content before Auth deletion';
