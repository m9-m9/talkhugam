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
    where room_id = p_room_id
      and profile_id = auth.uid()
      and role in ('owner', 'manager')
      and status = 'active'
  );
$$;

revoke all on function private.can_manage_room_content(uuid) from public, anon;

create or replace function public.update_room_member_role(
  p_room_id uuid,
  p_target_member_id uuid,
  p_role public.member_role
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if not private.is_room_owner(p_room_id) or p_role = 'owner' then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  update public.room_members
  set role = p_role
  where id = p_target_member_id
    and room_id = p_room_id
    and status = 'active'
    and role <> 'owner';

  if not found then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;
end;
$$;

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
  if p_expires_in <= interval '0 seconds' or p_expires_in > interval '30 days'
    or (p_max_uses is not null and p_max_uses not between 1 and 20) then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  select id into v_member_id from public.room_members
  where room_id = p_room_id and profile_id = auth.uid()
    and role in ('owner', 'manager') and status = 'active';
  v_code := private.generate_invite_code();
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_expires_at := now() + p_expires_in;

  insert into public.room_invites (room_id, created_by_member_id, code_hash, token_hash, expires_at, max_uses)
  values (p_room_id, v_member_id, private.hash_invite_value(v_code), private.hash_invite_value(v_token), v_expires_at, p_max_uses)
  returning id into v_invite_id;
  return query select v_invite_id, v_code, v_token, v_expires_at;
end;
$$;

create or replace function public.revoke_room_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare v_room_id uuid;
begin
  select room_id into v_room_id from public.room_invites where id = p_invite_id for update;
  if v_room_id is null then raise exception using errcode = 'P0001', message = 'INVITE_INVALID'; end if;
  if not private.can_manage_room_content(v_room_id) then raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN'; end if;
  update public.room_invites set revoked_at = coalesce(revoked_at, now()) where id = p_invite_id;
end;
$$;

revoke all on function public.update_room_member_role(uuid, uuid, public.member_role) from public, anon;
grant execute on function public.update_room_member_role(uuid, uuid, public.member_role) to authenticated;
comment on function private.can_manage_room_content(uuid) is '현재 사용자가 방장 또는 운영자로서 초대와 책 콘텐츠를 관리할 수 있는지 판별한다.';
comment on function public.update_room_member_role(uuid, uuid, public.member_role) is '방장만 활성 멤버를 운영자 또는 참여자로 변경한다. 방장 이양은 별도 RPC로 처리한다.';
comment on function public.create_room_invite(uuid, interval, smallint) is '방장 또는 운영자가 초대 코드를 만들고 한 번만 반환한다.';
comment on function public.revoke_room_invite(uuid) is '방장 또는 운영자가 자신이 참여한 방의 활성 초대를 폐기한다.';

create or replace function private.enforce_book_chat_creation_role()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if current_setting('role', true) = 'authenticated'
    and not private.can_manage_room_content(new.room_id)
  then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;
  return new;
end;
$$;

drop trigger if exists book_chats_enforce_manager_role on public.book_chats;
create trigger book_chats_enforce_manager_role
before insert on public.book_chats
for each row execute function private.enforce_book_chat_creation_role();

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

revoke all on function private.enforce_book_chat_creation_role() from public, anon, authenticated;
comment on function private.enforce_book_chat_creation_role() is '인증된 사용자의 책 대화 직접 생성을 방장 또는 운영자로 제한한다.';
