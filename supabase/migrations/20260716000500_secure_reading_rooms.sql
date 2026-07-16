create or replace function private.is_active_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.room_members
    where room_id = p_room_id
      and profile_id = (select auth.uid())
      and status = 'active'
  );
$$;

create or replace function private.is_room_owner(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.room_members
    where room_id = p_room_id
      and profile_id = (select auth.uid())
      and role = 'owner'
      and status = 'active'
  );
$$;

create or replace function private.current_room_member_id(p_room_id uuid)
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select id
  from public.room_members
  where room_id = p_room_id
    and profile_id = (select auth.uid())
    and status = 'active'
  limit 1;
$$;

create or replace function private.shares_active_room(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.room_members as current_member
    join public.room_members as target_member
      on target_member.room_id = current_member.room_id
    join public.reading_rooms as room
      on room.id = current_member.room_id
    where current_member.profile_id = (select auth.uid())
      and current_member.status = 'active'
      and target_member.profile_id = p_profile_id
      and target_member.status = 'active'
      and room.deleted_at is null
  );
$$;

revoke all on function private.is_active_room_member(uuid) from public, anon;
revoke all on function private.is_room_owner(uuid) from public, anon;
revoke all on function private.current_room_member_id(uuid) from public, anon;
revoke all on function private.shares_active_room(uuid) from public, anon;

grant usage on schema private to authenticated;
grant execute on function private.is_active_room_member(uuid) to authenticated;
grant execute on function private.is_room_owner(uuid) to authenticated;
grant execute on function private.current_room_member_id(uuid) to authenticated;
grant execute on function private.shares_active_room(uuid) to authenticated;

alter table public.reading_rooms enable row level security;
alter table public.room_members enable row level security;

revoke all on table public.reading_rooms from anon, authenticated;
revoke all on table public.room_members from anon, authenticated;

grant select on table public.reading_rooms to authenticated;
grant update (name, description) on table public.reading_rooms to authenticated;
grant select on table public.room_members to authenticated;
grant update (room_display_name, room_avatar_path) on table public.room_members to authenticated;

create policy reading_rooms_select_active_member
on public.reading_rooms
for select
to authenticated
using (deleted_at is null and private.is_active_room_member(id));

create policy reading_rooms_update_owner
on public.reading_rooms
for update
to authenticated
using (deleted_at is null and private.is_room_owner(id))
with check (deleted_at is null and private.is_room_owner(id));

create policy room_members_select_active_room
on public.room_members
for select
to authenticated
using (status = 'active' and private.is_active_room_member(room_id));

create policy room_members_update_self
on public.room_members
for update
to authenticated
using (profile_id = (select auth.uid()) and status = 'active')
with check (profile_id = (select auth.uid()) and status = 'active');

drop policy profiles_select_self on public.profiles;

create policy profiles_select_self_or_shared_room
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or private.shares_active_room(id)
);
