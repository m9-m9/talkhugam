create or replace function public.ban_community_member(p_room_id uuid, p_target_member_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor public.room_members%rowtype;
  v_target_member public.room_members%rowtype;
begin
  select member.* into v_actor
  from public.room_members as member
  join public.reading_rooms as room on room.id = member.room_id
  where member.room_id = p_room_id
    and member.profile_id = auth.uid()
    and member.role in ('owner', 'manager')
    and member.status = 'active'
    and room.room_kind = 'community'
    and room.status = 'active'
  for update of member;

  if v_actor.id is null then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  select * into v_target_member
  from public.room_members
  where room_members.id = p_target_member_id
    and room_members.room_id = p_room_id
    and room_members.status = 'active'
    and room_members.profile_id is not null
  for update;

  if v_target_member.id is null or v_target_member.id = v_actor.id or v_target_member.role = 'owner' then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  if v_actor.role = 'manager' and v_target_member.role <> 'member' then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  insert into public.room_bans (room_id, profile_id, banned_by_member_id)
  values (p_room_id, v_target_member.profile_id, v_actor.id)
  on conflict (room_id, profile_id) do nothing;

  update public.room_members
  set role = 'member', status = 'removed', left_at = now()
  where room_members.id = v_target_member.id;
end;
$$;

drop function public.get_community_room(uuid);

create function public.get_community_room(p_room_id uuid)
returns table (
  id uuid,
  name text,
  description text,
  access text,
  capacity smallint,
  active_member_count bigint,
  created_by uuid,
  current_member_id uuid,
  is_owner boolean,
  current_member_role public.member_role
)
language plpgsql stable security definer set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED'; end if;
  if p_room_id is null then raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED'; end if;
  if not private.is_active_room_member(p_room_id) then raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN'; end if;

  return query
  select room.id, room.name::text, room.description::text, room.access, room.capacity,
    (select count(*) from public.room_members as counted_member where counted_member.room_id = room.id and counted_member.status = 'active')::bigint,
    room.created_by, member.id, (member.role = 'owner'), member.role
  from public.reading_rooms as room
  join public.room_members as member on member.room_id = room.id and member.profile_id = auth.uid() and member.status = 'active'
  where room.id = p_room_id and room.room_kind = 'community' and room.status = 'active' and room.deleted_at is null;
end;
$$;

drop function public.list_community_messages(uuid, integer);

create function public.list_community_messages(p_room_id uuid, p_limit integer default 100)
returns table (
  id uuid,
  body text,
  created_at timestamptz,
  sender_member_id uuid,
  sender_profile_id uuid,
  sender_display_name text,
  sender_role public.member_role
)
language plpgsql stable security definer set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED'; end if;
  if p_room_id is null or p_limit is null or p_limit not between 1 and 100 then raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED'; end if;
  if not private.is_active_room_member(p_room_id) then raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN'; end if;
  if not exists (select 1 from public.reading_rooms as room where room.id = p_room_id and room.room_kind = 'community' and room.status = 'active' and room.deleted_at is null) then raise exception using errcode = 'P0001', message = 'ROOM_NOT_FOUND'; end if;

  return query
  select message.id, message.body::text, message.created_at, sender.id, sender.profile_id, sender.room_display_name::text, sender.role
  from public.community_messages as message
  join public.room_members as sender on sender.id = message.sender_member_id
  where message.room_id = p_room_id and message.deleted_at is null
  order by message.created_at desc, message.id desc
  limit p_limit;
end;
$$;

revoke all on function public.get_community_room(uuid) from public, anon;
revoke all on function public.list_community_messages(uuid, integer) from public, anon;
grant execute on function public.get_community_room(uuid) to authenticated;
grant execute on function public.list_community_messages(uuid, integer) to authenticated;

comment on function public.ban_community_member(uuid, uuid)
is '오픈 책방 방장은 방장 외 멤버를, 운영자는 참여자만 퇴장시키고 재입장을 금지한다.';
comment on function public.get_community_room(uuid)
is '활성 오픈 책방 멤버에게만 방 정보와 본인 멤버 식별자·역할을 제한해 조회한다.';
comment on function public.list_community_messages(uuid, integer)
is '활성 오픈 책방 멤버에게만 자유 채팅 표시 필드와 보낸 사람 역할을 최근 순서로 제한해 조회한다.';
