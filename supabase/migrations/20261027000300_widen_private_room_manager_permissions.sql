drop policy room_invites_select_owner on public.room_invites;

create policy room_invites_select_room_content_manager
on public.room_invites
for select
to authenticated
using (private.can_manage_room_content(room_id));

create or replace function public.create_room_invite(
  p_room_id uuid,
  p_expires_in interval default interval '7 days',
  p_max_uses smallint default null
)
returns table (invite_id uuid, code text, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_member_id uuid;
  v_invite_id uuid;
  v_code text;
  v_token text;
  v_expires_at timestamptz;
begin
  if not private.can_manage_room_content(p_room_id) then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  if not exists (
    select 1 from public.reading_rooms as room
    where room.id = p_room_id and room.room_kind = 'private' and room.status = 'active' and room.deleted_at is null
  ) then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  if p_expires_in <= interval '0 seconds' or p_expires_in > interval '30 days'
    or (p_max_uses is not null and p_max_uses not between 1 and 20)
  then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  v_member_id := private.current_room_member_id(p_room_id);
  v_code := private.generate_invite_code();
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_expires_at := now() + p_expires_in;

  insert into public.room_invites (
    room_id, created_by_member_id, code_hash, token_hash, expires_at, max_uses
  ) values (
    p_room_id, v_member_id, private.hash_invite_value(v_code), private.hash_invite_value(v_token), v_expires_at, p_max_uses
  ) returning room_invites.id into v_invite_id;

  return query select v_invite_id, v_code, v_token, v_expires_at;
end;
$$;

create or replace function public.revoke_room_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_room_id uuid;
begin
  select room_id
  into v_room_id
  from public.room_invites
  where id = p_invite_id
  for update;

  if v_room_id is null then
    raise exception using errcode = 'P0001', message = 'INVITE_INVALID';
  end if;

  if not private.can_manage_room_content(v_room_id) then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  update public.room_invites
  set revoked_at = coalesce(revoked_at, now())
  where id = p_invite_id;
end;
$$;

create or replace function public.request_room_invite(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_requester public.room_members%rowtype;
  v_inserted_count integer;
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  select *
  into v_requester
  from public.room_members
  where room_members.room_id = p_room_id
    and room_members.profile_id = auth.uid()
    and room_members.status = 'active';

  if v_requester.id is null then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  if v_requester.role = 'owner' then
    raise exception using errcode = 'P0001', message = 'ROOM_OWNER_CANNOT_REQUEST_INVITE';
  end if;

  if v_requester.role = 'manager' then
    raise exception using errcode = 'P0001', message = 'ROOM_MANAGER_CANNOT_REQUEST_INVITE';
  end if;

  if not exists (
    select 1
    from public.room_members
    where room_members.room_id = p_room_id
      and room_members.role = 'owner'
      and room_members.status = 'active'
      and room_members.profile_id is not null
  ) then
    raise exception using errcode = 'P0001', message = 'ROOM_OWNER_NOT_FOUND';
  end if;

  insert into public.notifications (recipient_profile_id, actor_member_id, room_id, type)
  select recipient.profile_id, v_requester.id, p_room_id, 'invite_request'::public.notification_type
  from public.room_members as recipient
  where recipient.room_id = p_room_id
    and recipient.role in ('owner', 'manager')
    and recipient.status = 'active'
    and recipient.profile_id is not null
  on conflict (recipient_profile_id, actor_member_id, room_id)
    where type = 'invite_request' and read_at is null
    do nothing;

  get diagnostics v_inserted_count = row_count;
  return v_inserted_count > 0;
end;
$$;

create or replace function public.set_book_chat_status(
  p_book_chat_id uuid,
  p_status public.book_chat_status
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_chat public.book_chats%rowtype;
begin
  select *
  into v_chat
  from public.book_chats
  where id = p_book_chat_id and deleted_at is null
  for update;

  if v_chat.id is null then
    raise exception using errcode = 'P0001', message = 'BOOK_CHAT_NOT_FOUND';
  end if;

  if not private.can_manage_room_content(v_chat.room_id) then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  if p_status = 'deleted' then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  update public.book_chats
  set
    status = p_status,
    completed_at = case
      when p_status = 'completed' then coalesce(completed_at, now())
      when p_status = 'reading' then null
      else completed_at
    end,
    archived_at = case when p_status = 'archived' then now() else null end
  where id = p_book_chat_id;
end;
$$;

comment on function public.create_room_invite(uuid, interval, smallint)
is '활성 비공개 책방의 방장 또는 운영자만 초대 코드를 만들고, 평문 코드와 토큰은 한 번만 반환한다.';
comment on function public.revoke_room_invite(uuid)
is '해당 책방의 방장 또는 운영자만 초대 코드를 즉시 폐기한다.';
comment on function public.request_room_invite(uuid)
is '참여자가 방장과 운영자에게 책방 초대를 요청하고, 수신자별로 읽지 않은 중복 요청을 막는다.';
comment on function public.set_book_chat_status(uuid, public.book_chat_status)
is '방장 또는 운영자만 책 대화를 읽는 중·종료·보관 상태로 바꾼다.';
