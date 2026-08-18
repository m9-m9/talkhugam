create or replace function public.get_community_room(p_room_id uuid)
returns table (id uuid, name text, description text, access text, capacity smallint, active_member_count bigint, created_by uuid, current_member_id uuid, is_owner boolean)
language plpgsql stable security definer set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED'; end if;
  if p_room_id is null then raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED'; end if;
  if not private.is_active_room_member(p_room_id) then raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN'; end if;

  return query
  select room.id, room.name::text, room.description::text, room.access, room.capacity,
    (select count(*) from public.room_members as counted_member where counted_member.room_id = room.id and counted_member.status = 'active')::bigint,
    room.created_by, member.id, (member.role = 'owner')
  from public.reading_rooms as room
  join public.room_members as member on member.room_id = room.id and member.profile_id = auth.uid() and member.status = 'active'
  where room.id = p_room_id and room.room_kind = 'community' and room.status = 'active' and room.deleted_at is null;
end;
$$;

create or replace function public.list_community_messages(p_room_id uuid, p_limit integer default 100)
returns table (id uuid, body text, created_at timestamptz, sender_member_id uuid, sender_profile_id uuid, sender_display_name text)
language plpgsql stable security definer set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED'; end if;
  if p_room_id is null or p_limit is null or p_limit not between 1 and 100 then raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED'; end if;
  if not private.is_active_room_member(p_room_id) then raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN'; end if;
  if not exists (select 1 from public.reading_rooms as room where room.id = p_room_id and room.room_kind = 'community' and room.status = 'active' and room.deleted_at is null) then raise exception using errcode = 'P0001', message = 'ROOM_NOT_FOUND'; end if;

  return query
  select message.id, message.body::text, message.created_at, sender.id, sender.profile_id, sender.room_display_name::text
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

comment on function public.get_community_room(uuid) is '활성 오픈 책방 멤버에게만 방 정보와 본인 멤버 권한을 제한해 조회한다.';
comment on function public.list_community_messages(uuid, integer) is '활성 오픈 책방 멤버에게만 자유 채팅 표시 필드를 최근 순서로 제한해 조회한다.';
