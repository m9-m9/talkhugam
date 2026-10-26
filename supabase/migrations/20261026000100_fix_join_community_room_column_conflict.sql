create or replace function public.join_community_room(
  p_room_id uuid,
  p_room_display_name text,
  p_password text default null
)
returns table (room_id uuid, member_id uuid, joined boolean)
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_profile_id uuid := auth.uid();
  v_room public.reading_rooms%rowtype;
  v_member public.room_members%rowtype;
  v_active_member_count integer;
  v_password_hash text;
begin
  if v_profile_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  if not exists (select 1 from public.profiles where id = v_profile_id) then
    raise exception using errcode = 'P0001', message = 'PROFILE_REQUIRED';
  end if;

  if p_room_id is null or p_room_display_name is null or char_length(btrim(p_room_display_name)) not between 1 and 30 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  select * into v_room
  from public.reading_rooms
  where id = p_room_id
  for update;

  if v_room.id is null or v_room.room_kind <> 'community' then
    raise exception using errcode = 'P0001', message = 'ROOM_NOT_FOUND';
  end if;

  if v_room.status <> 'active' or v_room.deleted_at is not null then
    raise exception using errcode = 'P0001', message = 'ROOM_ARCHIVED';
  end if;

  select * into v_member
  from public.room_members
  where room_members.room_id = v_room.id and room_members.profile_id = v_profile_id
  for update;

  if v_member.id is not null and v_member.status = 'active' then
    return query select v_room.id, v_member.id, false;
    return;
  end if;

  if exists (
    select 1 from public.room_bans
    where room_bans.room_id = v_room.id and room_bans.profile_id = v_profile_id
  ) then
    raise exception using errcode = 'P0001', message = 'ROOM_BANNED';
  end if;

  if v_room.access = 'password' then
    select password_hash into v_password_hash
    from private.community_room_access_secrets
    where community_room_access_secrets.room_id = v_room.id;

    if p_password is null or extensions.crypt(p_password, v_password_hash) <> v_password_hash then
      raise exception using errcode = 'P0001', message = 'COMMUNITY_PASSWORD_INVALID';
    end if;
  end if;

  select count(*) into v_active_member_count
  from public.room_members
  where room_members.room_id = v_room.id and room_members.status = 'active';

  if v_active_member_count >= v_room.capacity then
    raise exception using errcode = 'P0001', message = 'ROOM_FULL';
  end if;

  if v_member.id is null then
    insert into public.room_members (room_id, profile_id, role, status, room_display_name)
    values (v_room.id, v_profile_id, 'member', 'active', btrim(p_room_display_name))
    returning * into v_member;
  else
    update public.room_members
    set role = 'member', status = 'active', room_display_name = btrim(p_room_display_name), joined_at = now(), left_at = null
    where id = v_member.id
    returning * into v_member;
  end if;

  return query select v_room.id, v_member.id, true;
end;
$$;

