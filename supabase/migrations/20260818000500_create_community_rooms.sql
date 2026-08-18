alter table public.reading_rooms
  add column room_kind text not null default 'private',
  add column access text not null default 'invite',
  add column capacity smallint not null default 6;

alter table public.reading_rooms
  add constraint reading_rooms_kind_check
    check (room_kind in ('private', 'community')),
  add constraint reading_rooms_access_check
    check (access in ('invite', 'public', 'password')),
  add constraint reading_rooms_kind_access_capacity_check
    check (
      (room_kind = 'private' and access = 'invite' and capacity = 6)
      or (room_kind = 'community' and access in ('public', 'password') and capacity between 1 and 100)
    );

create index reading_rooms_community_discovery_idx
on public.reading_rooms (created_at desc, id)
where room_kind = 'community' and status = 'active' and deleted_at is null;

create table private.community_room_access_secrets (
  room_id uuid primary key references public.reading_rooms (id) on delete cascade,
  password_hash text not null,
  created_at timestamptz not null default now()
);

alter table private.community_room_access_secrets enable row level security;
revoke all on table private.community_room_access_secrets from public, anon, authenticated;

create table public.room_bans (
  room_id uuid not null references public.reading_rooms (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  banned_by_member_id uuid not null references public.room_members (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (room_id, profile_id)
);

create index room_bans_profile_idx on public.room_bans (profile_id, room_id);

alter table public.room_bans enable row level security;
revoke all on table public.room_bans from public, anon, authenticated;

create table public.community_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.reading_rooms (id) on delete cascade,
  sender_member_id uuid not null references public.room_members (id) on delete restrict,
  body varchar(2000) not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint community_messages_body_not_blank check (char_length(btrim(body)) between 1 and 2000)
);

create index community_messages_room_created_at_idx
on public.community_messages (room_id, created_at desc, id desc)
where deleted_at is null;

alter table public.community_messages enable row level security;
revoke all on table public.community_messages from public, anon, authenticated;
grant select on table public.community_messages to authenticated;

create policy community_messages_select_active_member
on public.community_messages
for select
to authenticated
using (
  deleted_at is null
  and private.is_active_room_member(room_id)
  and exists (
    select 1
    from public.reading_rooms as room
    where room.id = community_messages.room_id
      and room.room_kind = 'community'
      and room.status = 'active'
      and room.deleted_at is null
  )
);

create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_profile_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  reason varchar(500) not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolution_note varchar(500),
  constraint content_reports_target_type_check check (target_type in ('room', 'profile', 'community_message')),
  constraint content_reports_reason_not_blank check (char_length(btrim(reason)) between 1 and 500),
  constraint content_reports_status_check check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  constraint content_reports_resolution_check check (
    (status in ('open', 'reviewing') and resolved_at is null and resolved_by is null)
    or (status in ('resolved', 'dismissed') and resolved_at is not null and resolved_by is not null)
  )
);

create index content_reports_status_created_at_idx
on public.content_reports (status, created_at desc);

alter table public.content_reports enable row level security;
revoke all on table public.content_reports from public, anon, authenticated;

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
      and room.room_kind = 'private'
      and room.deleted_at is null
  );
$$;

create or replace function public.create_community_room(
  p_name text,
  p_description text,
  p_room_display_name text,
  p_access text,
  p_capacity smallint,
  p_password text default null
)
returns table (room_id uuid, member_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
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

  if p_name is null
    or p_room_display_name is null
    or p_access is null
    or p_capacity is null
    or char_length(btrim(p_name)) not between 1 and 40
    or char_length(btrim(p_room_display_name)) not between 1 and 30
    or p_access not in ('public', 'password')
    or p_capacity not between 1 and 100
  then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  if p_access = 'password' and (p_password is null or char_length(p_password) not between 8 and 72) then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  if p_access = 'public' and p_password is not null then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  insert into public.reading_rooms (
    name, description, created_by, room_kind, access, capacity
  )
  values (
    btrim(p_name), nullif(btrim(p_description), ''), v_profile_id, 'community', p_access, p_capacity
  )
  returning id into v_room_id;

  if p_access = 'password' then
    insert into private.community_room_access_secrets (room_id, password_hash)
    values (v_room_id, extensions.crypt(p_password, extensions.gen_salt('bf', 10)));
  end if;

  insert into public.room_members (room_id, profile_id, role, status, room_display_name)
  values (v_room_id, v_profile_id, 'owner', 'active', btrim(p_room_display_name))
  returning id into v_member_id;

  return query select v_room_id, v_member_id;
end;
$$;

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
  where room_id = v_room.id and profile_id = v_profile_id
  for update;

  if v_member.id is not null and v_member.status = 'active' then
    return query select v_room.id, v_member.id, false;
    return;
  end if;

  if exists (
    select 1 from public.room_bans
    where room_id = v_room.id and profile_id = v_profile_id
  ) then
    raise exception using errcode = 'P0001', message = 'ROOM_BANNED';
  end if;

  if v_room.access = 'password' then
    select password_hash into v_password_hash
    from private.community_room_access_secrets
    where room_id = v_room.id;

    if p_password is null or extensions.crypt(p_password, v_password_hash) <> v_password_hash then
      raise exception using errcode = 'P0001', message = 'COMMUNITY_PASSWORD_INVALID';
    end if;
  end if;

  select count(*) into v_active_member_count
  from public.room_members
  where room_id = v_room.id and status = 'active';

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

create or replace function public.list_community_rooms(p_limit integer default 20)
returns table (
  id uuid,
  name text,
  description text,
  access text,
  capacity smallint,
  active_member_count bigint,
  created_by uuid,
  is_following_creator boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  if p_limit is null or p_limit not between 1 and 50 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  return query
  select
    room.id,
    room.name::text,
    room.description::text,
    room.access,
    room.capacity,
    (select count(*) from public.room_members as member where member.room_id = room.id and member.status = 'active')::bigint,
    room.created_by,
    exists (
      select 1 from public.follows
      where follower_profile_id = auth.uid() and followed_profile_id = room.created_by
    )
  from public.reading_rooms as room
  where room.room_kind = 'community'
    and room.status = 'active'
    and room.deleted_at is null
  order by
    exists (
      select 1 from public.follows
      where follower_profile_id = auth.uid() and followed_profile_id = room.created_by
    ) desc,
    room.created_at desc,
    room.id
  limit p_limit;
end;
$$;

create or replace function public.send_community_message(p_room_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_member public.room_members%rowtype;
  v_message_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  if p_room_id is null or p_body is null or char_length(btrim(p_body)) not between 1 and 2000 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  select member.* into v_member
  from public.room_members as member
  join public.reading_rooms as room on room.id = member.room_id
  where member.room_id = p_room_id
    and member.profile_id = auth.uid()
    and member.status = 'active'
    and room.room_kind = 'community'
    and room.status = 'active'
    and room.deleted_at is null
  for update of member;

  if v_member.id is null then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  insert into public.community_messages (room_id, sender_member_id, body)
  values (p_room_id, v_member.id, btrim(p_body))
  returning id into v_message_id;

  return v_message_id;
end;
$$;

create or replace function public.ban_community_member(p_room_id uuid, p_target_member_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_owner_member_id uuid;
  v_target_member public.room_members%rowtype;
begin
  select member.id into v_owner_member_id
  from public.room_members as member
  join public.reading_rooms as room on room.id = member.room_id
  where member.room_id = p_room_id
    and member.profile_id = auth.uid()
    and member.role = 'owner'
    and member.status = 'active'
    and room.room_kind = 'community'
    and room.status = 'active'
  for update of member;

  if v_owner_member_id is null then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  select * into v_target_member
  from public.room_members
  where id = p_target_member_id
    and room_id = p_room_id
    and status = 'active'
    and profile_id is not null
  for update;

  if v_target_member.id is null or v_target_member.id = v_owner_member_id or v_target_member.role = 'owner' then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  insert into public.room_bans (room_id, profile_id, banned_by_member_id)
  values (p_room_id, v_target_member.profile_id, v_owner_member_id)
  on conflict (room_id, profile_id) do nothing;

  update public.room_members
  set role = 'member', status = 'removed', left_at = now()
  where id = v_target_member.id;
end;
$$;

create or replace function public.create_content_report(
  p_target_type text,
  p_target_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_reporter_profile_id uuid := auth.uid();
  v_report_id uuid;
  v_is_allowed boolean := false;
begin
  if v_reporter_profile_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  if p_target_type is null
    or p_reason is null
    or p_target_type not in ('room', 'profile', 'community_message')
    or p_target_id is null
    or char_length(btrim(p_reason)) not between 1 and 500
  then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  if p_target_type = 'profile' then
    select exists (select 1 from public.profiles where id = p_target_id) into v_is_allowed;
  elsif p_target_type = 'room' then
    select exists (
      select 1 from public.reading_rooms as room
      where room.id = p_target_id
        and room.deleted_at is null
        and (room.room_kind = 'community' or private.is_active_room_member(room.id))
    ) into v_is_allowed;
  else
    select exists (
      select 1
      from public.community_messages as message
      where message.id = p_target_id
        and private.is_active_room_member(message.room_id)
    ) into v_is_allowed;
  end if;

  if not v_is_allowed then
    raise exception using errcode = 'P0001', message = 'REPORT_TARGET_NOT_FOUND';
  end if;

  insert into public.content_reports (reporter_profile_id, target_type, target_id, reason)
  values (v_reporter_profile_id, p_target_type, p_target_id, btrim(p_reason))
  returning id into v_report_id;

  return v_report_id;
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
  if not private.is_room_owner(p_room_id) then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  if not exists (
    select 1 from public.reading_rooms
    where id = p_room_id and room_kind = 'private' and status = 'active' and deleted_at is null
  ) then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  if p_expires_in <= interval '0 seconds' or p_expires_in > interval '30 days'
    or (p_max_uses is not null and p_max_uses not between 1 and 20)
  then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  select id into v_member_id
  from public.room_members
  where room_id = p_room_id and profile_id = auth.uid() and role = 'owner' and status = 'active';

  v_code := private.generate_invite_code();
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_expires_at := now() + p_expires_in;

  insert into public.room_invites (
    room_id, created_by_member_id, code_hash, token_hash, expires_at, max_uses
  ) values (
    p_room_id, v_member_id, private.hash_invite_value(v_code), private.hash_invite_value(v_token), v_expires_at, p_max_uses
  ) returning id into v_invite_id;

  return query select v_invite_id, v_code, v_token, v_expires_at;
end;
$$;

revoke all on function public.create_community_room(text, text, text, text, smallint, text) from public, anon;
revoke all on function public.join_community_room(uuid, text, text) from public, anon;
revoke all on function public.list_community_rooms(integer) from public, anon;
revoke all on function public.send_community_message(uuid, text) from public, anon;
revoke all on function public.ban_community_member(uuid, uuid) from public, anon;
revoke all on function public.create_content_report(text, uuid, text) from public, anon;
revoke all on function public.create_room_invite(uuid, interval, smallint) from public, anon;

grant execute on function public.create_community_room(text, text, text, text, smallint, text) to authenticated;
grant execute on function public.join_community_room(uuid, text, text) to authenticated;
grant execute on function public.list_community_rooms(integer) to authenticated;
grant execute on function public.send_community_message(uuid, text) to authenticated;
grant execute on function public.ban_community_member(uuid, uuid) to authenticated;
grant execute on function public.create_content_report(text, uuid, text) to authenticated;
grant execute on function public.create_room_invite(uuid, interval, smallint) to authenticated;

comment on table public.room_bans is '오픈 책방 방장이 재입장을 막기 위해 보관하는 멤버 제재 기록이다.';
comment on table public.community_messages is '오픈 책방 활성 멤버만 조회하고 RPC로 작성하는 자유 채팅 메시지다.';
comment on table public.content_reports is '방·프로필·자유 채팅 신고와 운영자 조치 이력을 보관한다.';
comment on function private.shares_active_room(uuid) is '현재 사용자와 대상 프로필이 활성 비공개 독서방을 공유하는지 판별한다.';
comment on function public.create_community_room(text, text, text, text, smallint, text) is '현재 사용자를 방장으로 하여 공개 또는 비밀번호 오픈 책방을 정원과 함께 생성한다.';
comment on function public.join_community_room(uuid, text, text) is '비밀번호 원문을 저장하지 않고 검증해 현재 사용자를 오픈 책방 활성 멤버로 참여시킨다.';
comment on function public.list_community_rooms(integer) is '현재 사용자가 참여 가능한 오픈 책방을 팔로우한 생성자 우선순위로 공개 필드만 조회한다.';
comment on function public.send_community_message(uuid, text) is '활성 오픈 책방 멤버만 자유 채팅 메시지를 작성하도록 검증한다.';
comment on function public.ban_community_member(uuid, uuid) is '오픈 책방 방장만 대상 멤버를 퇴장시키고 재입장을 금지한다.';
comment on function public.create_content_report(text, uuid, text) is '현재 사용자가 접근 가능한 방·프로필·자유 채팅을 신고하도록 기록한다.';
comment on function public.create_room_invite(uuid, interval, smallint) is '기존 비공개 독서방 방장만 초대 코드를 생성하도록 제한한다.';
