create or replace function private.can_manage_room_content(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.room_members
    where room_members.room_id = p_room_id
      and room_members.profile_id = (select auth.uid())
      and room_members.role in ('owner', 'manager')
      and room_members.status = 'active'
  );
$$;

create or replace function public.get_my_room_role(p_room_id uuid)
returns public.member_role
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select member.role
  from public.room_members as member
  join public.reading_rooms as room on room.id = member.room_id
  where member.room_id = p_room_id
    and member.profile_id = (select auth.uid())
    and member.status = 'active'
    and room.deleted_at is null;
$$;

create or replace function public.update_room_member_role(
  p_room_id uuid,
  p_member_id uuid,
  p_role public.member_role
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_owner_member_id uuid;
  v_target_member_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  select member.id
  into v_owner_member_id
  from public.room_members as member
  join public.reading_rooms as room on room.id = member.room_id
  where member.room_id = p_room_id
    and member.profile_id = auth.uid()
    and member.role = 'owner'
    and member.status = 'active'
    and room.status = 'active'
    and room.deleted_at is null
  for update of member;

  if v_owner_member_id is null then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  if p_role is null or p_role not in ('manager', 'member') then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  update public.room_members as target
  set role = p_role
  where target.id = p_member_id
    and target.room_id = p_room_id
    and target.status = 'active'
    and target.role <> 'owner'
    and target.profile_id is not null
  returning target.id into v_target_member_id;

  if v_target_member_id is null then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;
end;
$$;

revoke all on function private.can_manage_room_content(uuid) from public, anon;
revoke all on function public.get_my_room_role(uuid) from public, anon;
revoke all on function public.update_room_member_role(uuid, uuid, public.member_role) from public, anon;

grant execute on function private.can_manage_room_content(uuid) to authenticated;
grant execute on function public.get_my_room_role(uuid) to authenticated;
grant execute on function public.update_room_member_role(uuid, uuid, public.member_role) to authenticated;

comment on function private.can_manage_room_content(uuid)
is '현재 사용자가 해당 책방의 활성 방장 또는 운영자로서 초대·책 대화 같은 콘텐츠를 관리할 수 있는지 판별한다.';
comment on function public.get_my_room_role(uuid)
is '현재 사용자의 활성 책방 역할을 반환하고, 활성 멤버가 아니거나 삭제된 책방이면 null을 반환한다.';
comment on function public.update_room_member_role(uuid, uuid, public.member_role)
is '활성 책방의 방장만 다른 활성 멤버를 운영자 또는 참여자로 바꾼다. 방장 이양은 transfer_room_ownership으로만 처리한다.';
