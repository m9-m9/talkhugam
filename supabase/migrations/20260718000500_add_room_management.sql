create or replace function public.remove_room_member(
  p_room_id uuid,
  p_target_member_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_owner_member_id uuid;
  v_target_member public.room_members%rowtype;
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

  select *
  into v_target_member
  from public.room_members
  where id = p_target_member_id
    and room_id = p_room_id
    and status = 'active'
  for update;

  if v_target_member.id is null
    or v_target_member.id = v_owner_member_id
    or v_target_member.role = 'owner'
  then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  update public.room_members
  set
    role = 'member',
    status = 'removed',
    left_at = now()
  where id = v_target_member.id;
end;
$$;

create or replace function public.get_my_archived_reading_rooms()
returns table (
  id uuid,
  name text,
  description text,
  archived_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    room.id,
    room.name::text,
    room.description::text,
    room.archived_at
  from public.reading_rooms as room
  where room.created_by = auth.uid()
    and room.status = 'archived'
    and room.deleted_at is null
  order by room.archived_at desc;
$$;

revoke all on function public.remove_room_member(uuid, uuid) from public, anon;
revoke all on function public.get_my_archived_reading_rooms() from public, anon;

grant execute on function public.remove_room_member(uuid, uuid) to authenticated;
grant execute on function public.get_my_archived_reading_rooms() to authenticated;

comment on function public.remove_room_member(uuid, uuid)
is 'Owner-only active member removal that preserves the membership audit record';
comment on function public.get_my_archived_reading_rooms()
is 'Returns archived rooms created by the current user after their owner membership has ended';
