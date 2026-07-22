create unique index notifications_unread_invite_request_unique
on public.notifications (recipient_profile_id, actor_member_id, room_id)
where type = 'invite_request' and read_at is null;

create or replace function public.request_room_invite(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_requester public.room_members%rowtype;
  v_owner_profile_id uuid;
  v_notification_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  select *
  into v_requester
  from public.room_members
  where room_id = p_room_id
    and profile_id = auth.uid()
    and status = 'active';

  if v_requester.id is null then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  if v_requester.role = 'owner' then
    raise exception using errcode = 'P0001', message = 'ROOM_OWNER_CANNOT_REQUEST_INVITE';
  end if;

  select profile_id
  into v_owner_profile_id
  from public.room_members
  where room_id = p_room_id
    and role = 'owner'
    and status = 'active'
    and profile_id is not null;

  if v_owner_profile_id is null then
    raise exception using errcode = 'P0001', message = 'ROOM_OWNER_NOT_FOUND';
  end if;

  insert into public.notifications (
    recipient_profile_id,
    actor_member_id,
    room_id,
    type
  )
  values (
    v_owner_profile_id,
    v_requester.id,
    p_room_id,
    'invite_request'
  )
  on conflict (recipient_profile_id, actor_member_id, room_id)
    where type = 'invite_request' and read_at is null
    do nothing
  returning id into v_notification_id;

  return v_notification_id is not null;
end;
$$;

revoke all on function public.request_room_invite(uuid) from public, anon;
grant execute on function public.request_room_invite(uuid) to authenticated;

comment on function public.request_room_invite(uuid)
is '활성 멤버가 방장에게 책방 초대를 요청하고 읽지 않은 중복 요청을 막는다.';
