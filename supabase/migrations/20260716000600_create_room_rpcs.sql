create or replace function public.create_reading_room(
  p_name text,
  p_description text,
  p_room_display_name text
)
returns table (room_id uuid, member_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_profile_id uuid := auth.uid();
  v_room_id uuid;
  v_member_id uuid;
begin
  if v_profile_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  if not exists (select 1 from public.profiles where id = v_profile_id) then
    raise exception using errcode = 'P0001', message = 'PROFILE_REQUIRED';
  end if;

  if char_length(btrim(p_name)) not between 1 and 40 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  if char_length(btrim(p_room_display_name)) not between 1 and 30 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  insert into public.reading_rooms (name, description, created_by)
  values (btrim(p_name), nullif(btrim(p_description), ''), v_profile_id)
  returning id into v_room_id;

  insert into public.room_members (
    room_id,
    profile_id,
    role,
    status,
    room_display_name
  )
  values (
    v_room_id,
    v_profile_id,
    'owner',
    'active',
    btrim(p_room_display_name)
  )
  returning id into v_member_id;

  return query select v_room_id, v_member_id;
end;
$$;

create or replace function public.update_room_member_profile(
  p_room_id uuid,
  p_room_display_name text,
  p_room_avatar_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_member_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  if char_length(btrim(p_room_display_name)) not between 1 and 30 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  update public.room_members
  set
    room_display_name = btrim(p_room_display_name),
    room_avatar_path = nullif(btrim(p_room_avatar_path), '')
  where room_id = p_room_id
    and profile_id = auth.uid()
    and status = 'active'
  returning id into v_member_id;

  if v_member_id is null then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  return v_member_id;
end;
$$;

create or replace function public.transfer_room_ownership(
  p_room_id uuid,
  p_target_member_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_owner_member_id uuid;
begin
  select id
  into v_owner_member_id
  from public.room_members
  where room_id = p_room_id
    and profile_id = auth.uid()
    and role = 'owner'
    and status = 'active'
  for update;

  if v_owner_member_id is null then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  perform 1
  from public.room_members
  where id = p_target_member_id
    and room_id = p_room_id
    and status = 'active'
    and profile_id is not null
    and id <> v_owner_member_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  update public.room_members
  set role = 'member'
  where id = v_owner_member_id;

  update public.room_members
  set role = 'owner'
  where id = p_target_member_id;
end;
$$;

create or replace function public.leave_room(
  p_room_id uuid,
  p_last_owner_action text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_member public.room_members%rowtype;
  v_active_member_count integer;
begin
  perform 1
  from public.reading_rooms
  where id = p_room_id and deleted_at is null
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'ROOM_NOT_FOUND';
  end if;

  select *
  into v_member
  from public.room_members
  where room_id = p_room_id
    and profile_id = auth.uid()
    and status = 'active'
  for update;

  if v_member.id is null then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  select count(*)
  into v_active_member_count
  from public.room_members
  where room_id = p_room_id and status = 'active';

  if v_member.role = 'owner' and v_active_member_count > 1 then
    raise exception using errcode = 'P0001', message = 'OWNER_TRANSFER_REQUIRED';
  end if;

  if v_member.role = 'owner' and p_last_owner_action not in ('archive', 'delete') then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  if v_member.role = 'owner' and p_last_owner_action = 'archive' then
    update public.reading_rooms
    set status = 'archived', archived_at = now()
    where id = p_room_id;
  end if;

  if v_member.role = 'owner' and p_last_owner_action = 'delete' then
    update public.reading_rooms
    set status = 'deleted', deleted_at = now()
    where id = p_room_id;
  end if;

  update public.room_members
  set status = 'left', role = 'member', left_at = now()
  where id = v_member.id;
end;
$$;

revoke all on function public.create_reading_room(text, text, text) from public, anon;
revoke all on function public.update_room_member_profile(uuid, text, text) from public, anon;
revoke all on function public.transfer_room_ownership(uuid, uuid) from public, anon;
revoke all on function public.leave_room(uuid, text) from public, anon;

grant execute on function public.create_reading_room(text, text, text) to authenticated;
grant execute on function public.update_room_member_profile(uuid, text, text) to authenticated;
grant execute on function public.transfer_room_ownership(uuid, uuid) to authenticated;
grant execute on function public.leave_room(uuid, text) to authenticated;
