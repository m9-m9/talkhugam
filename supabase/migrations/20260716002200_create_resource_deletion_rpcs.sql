create or replace function public.delete_reading_room(
  p_room_id uuid,
  p_confirmation_name text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_room public.reading_rooms%rowtype;
  v_job_id uuid;
begin
  select *
  into v_room
  from public.reading_rooms
  where id = p_room_id
  for update;

  if v_room.id is null then
    raise exception using errcode = 'P0001', message = 'ROOM_NOT_FOUND';
  end if;

  if not private.is_room_owner(v_room.id) then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  if btrim(p_confirmation_name) is distinct from v_room.name then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  if v_room.status = 'deleted' then
    select id
    into v_job_id
    from public.deletion_jobs
    where scope = 'room'
      and target_id = v_room.id
      and provider = 'mux'
      and status in ('queued', 'processing')
    limit 1;

    return v_job_id;
  end if;

  update public.reading_rooms
  set status = 'deleted', deleted_at = now(), archived_at = null
  where id = v_room.id;

  v_job_id := private.enqueue_deletion_job('room', v_room.id, 'mux');
  return v_job_id;
end;
$$;

create or replace function public.restore_reading_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_room public.reading_rooms%rowtype;
begin
  select *
  into v_room
  from public.reading_rooms
  where id = p_room_id
  for update;

  if v_room.id is null then
    raise exception using errcode = 'P0001', message = 'ROOM_NOT_FOUND';
  end if;

  if not private.is_room_owner(v_room.id) then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  if v_room.status <> 'deleted' then
    return;
  end if;

  if exists (
    select 1
    from public.deletion_jobs
    where scope = 'room'
      and target_id = v_room.id
      and provider = 'mux'
      and (status <> 'queued' or attempts <> 0)
  ) then
    raise exception using errcode = 'P0001', message = 'CONFLICT';
  end if;

  delete from public.deletion_jobs
  where scope = 'room'
    and target_id = v_room.id
    and provider = 'mux'
    and status = 'queued'
    and attempts = 0;

  update public.reading_rooms
  set status = 'active', deleted_at = null, archived_at = null
  where id = v_room.id;
end;
$$;

create or replace function public.delete_book_chat(
  p_book_chat_id uuid,
  p_confirmation_name text
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_chat public.book_chats%rowtype;
  v_member_id uuid;
  v_job_count integer;
begin
  select *
  into v_chat
  from public.book_chats
  where id = p_book_chat_id
  for update;

  if v_chat.id is null then
    raise exception using errcode = 'P0001', message = 'BOOK_CHAT_NOT_FOUND';
  end if;

  v_member_id := private.current_room_member_id(v_chat.room_id);
  if v_member_id is null then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  if not private.is_room_owner(v_chat.room_id)
    and v_chat.created_by_member_id is distinct from v_member_id
  then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  if btrim(p_confirmation_name) is distinct from v_chat.name then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  if v_chat.status <> 'deleted' then
    update public.book_chats
    set status = 'deleted', deleted_at = now(), archived_at = null
    where id = v_chat.id;

    perform private.enqueue_deletion_job('post', post.id, 'mux')
    from public.posts as post
    join public.video_assets as asset on asset.post_id = post.id
    where post.book_chat_id = v_chat.id
      and asset.status <> 'deleted';
  end if;

  select count(*)
  into v_job_count
  from public.deletion_jobs as job
  join public.posts as post on post.id = job.target_id
  where job.scope = 'post'
    and job.provider = 'mux'
    and job.status in ('queued', 'processing')
    and post.book_chat_id = v_chat.id;

  return v_job_count;
end;
$$;

create or replace function public.restore_book_chat(p_book_chat_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_chat public.book_chats%rowtype;
  v_member_id uuid;
begin
  select *
  into v_chat
  from public.book_chats
  where id = p_book_chat_id
  for update;

  if v_chat.id is null then
    raise exception using errcode = 'P0001', message = 'BOOK_CHAT_NOT_FOUND';
  end if;

  v_member_id := private.current_room_member_id(v_chat.room_id);
  if v_member_id is null then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  if not private.is_room_owner(v_chat.room_id)
    and v_chat.created_by_member_id is distinct from v_member_id
  then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  if v_chat.status <> 'deleted' then
    return;
  end if;

  if exists (
    select 1
    from public.deletion_jobs as job
    join public.posts as post on post.id = job.target_id
    where job.scope = 'post'
      and job.provider = 'mux'
      and post.book_chat_id = v_chat.id
      and (job.status <> 'queued' or job.attempts <> 0)
  ) then
    raise exception using errcode = 'P0001', message = 'CONFLICT';
  end if;

  delete from public.deletion_jobs as job
  using public.posts as post
  where post.id = job.target_id
    and post.book_chat_id = v_chat.id
    and job.scope = 'post'
    and job.provider = 'mux'
    and job.status = 'queued'
    and job.attempts = 0;

  update public.book_chats
  set status = 'archived', deleted_at = null, archived_at = now()
  where id = v_chat.id;
end;
$$;

revoke all on function public.delete_reading_room(uuid, text) from public, anon;
revoke all on function public.restore_reading_room(uuid) from public, anon;
revoke all on function public.delete_book_chat(uuid, text) from public, anon;
revoke all on function public.restore_book_chat(uuid) from public, anon;

grant execute on function public.delete_reading_room(uuid, text) to authenticated;
grant execute on function public.restore_reading_room(uuid) to authenticated;
grant execute on function public.delete_book_chat(uuid, text) to authenticated;
grant execute on function public.restore_book_chat(uuid) to authenticated;

comment on function public.delete_reading_room(uuid, text)
is 'Owner-only confirmed soft deletion with immediate RLS denial and a room-level Mux job';
comment on function public.restore_reading_room(uuid)
is 'Restores a room only before external deletion work has started';
comment on function public.delete_book_chat(uuid, text)
is 'Creator-or-owner confirmed chat deletion with one Mux job per video post';
comment on function public.restore_book_chat(uuid)
is 'Restores an unprocessed deleted chat to archived state for explicit reopening';
