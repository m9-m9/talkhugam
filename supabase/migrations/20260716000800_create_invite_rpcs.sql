create or replace function private.hash_invite_value(p_value text)
returns text
language sql
immutable
set search_path = pg_catalog, extensions
as $$
  select encode(extensions.digest(convert_to(p_value, 'UTF8'), 'sha256'), 'hex');
$$;

create or replace function private.generate_invite_code()
returns text
language plpgsql
volatile
set search_path = pg_catalog, extensions
as $$
declare
  v_alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_bytes bytea := extensions.gen_random_bytes(6);
  v_code text := '';
  v_index integer;
begin
  for v_index in 0..5 loop
    v_code := v_code || substr(
      v_alphabet,
      (get_byte(v_bytes, v_index) % char_length(v_alphabet)) + 1,
      1
    );
  end loop;

  return v_code;
end;
$$;

revoke all on function private.hash_invite_value(text) from public, anon, authenticated;
revoke all on function private.generate_invite_code() from public, anon, authenticated;

alter table public.room_invites enable row level security;

revoke all on table public.room_invites from anon, authenticated;
grant select on table public.room_invites to authenticated;

create policy room_invites_select_owner
on public.room_invites
for select
to authenticated
using (private.is_room_owner(room_id));

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

  if p_expires_in <= interval '0 seconds' or p_expires_in > interval '30 days' then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  if p_max_uses is not null and p_max_uses not between 1 and 20 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  select id
  into v_member_id
  from public.room_members
  where room_id = p_room_id
    and profile_id = auth.uid()
    and role = 'owner'
    and status = 'active';

  v_code := private.generate_invite_code();
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_expires_at := now() + p_expires_in;

  insert into public.room_invites (
    room_id,
    created_by_member_id,
    code_hash,
    token_hash,
    expires_at,
    max_uses
  )
  values (
    p_room_id,
    v_member_id,
    private.hash_invite_value(v_code),
    private.hash_invite_value(v_token),
    v_expires_at,
    p_max_uses
  )
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

  if not private.is_room_owner(v_room_id) then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  update public.room_invites
  set revoked_at = coalesce(revoked_at, now())
  where id = p_invite_id;
end;
$$;

create or replace function public.join_room_by_invite(
  p_code_or_token text,
  p_room_display_name text
)
returns table (room_id uuid, member_id uuid, joined boolean)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_profile_id uuid := auth.uid();
  v_value text := btrim(p_code_or_token);
  v_value_hash text;
  v_invite public.room_invites%rowtype;
  v_room public.reading_rooms%rowtype;
  v_member public.room_members%rowtype;
  v_active_member_count integer;
begin
  if v_profile_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  if char_length(btrim(p_room_display_name)) not between 1 and 30 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  if char_length(v_value) = 6 then
    v_value := upper(v_value);
  end if;

  v_value_hash := private.hash_invite_value(v_value);

  select *
  into v_invite
  from public.room_invites
  where code_hash = v_value_hash or token_hash = v_value_hash
  limit 1
  for update;

  if v_invite.id is null then
    raise exception using errcode = 'P0001', message = 'INVITE_INVALID';
  end if;

  if v_invite.revoked_at is not null then
    raise exception using errcode = 'P0001', message = 'INVITE_REVOKED';
  end if;

  if v_invite.expires_at <= now() then
    raise exception using errcode = 'P0001', message = 'INVITE_EXPIRED';
  end if;

  if v_invite.max_uses is not null and v_invite.use_count >= v_invite.max_uses then
    raise exception using errcode = 'P0001', message = 'INVITE_INVALID';
  end if;

  select *
  into v_room
  from public.reading_rooms
  where id = v_invite.room_id
  for update;

  if v_room.status <> 'active' or v_room.deleted_at is not null then
    raise exception using errcode = 'P0001', message = 'ROOM_ARCHIVED';
  end if;

  select *
  into v_member
  from public.room_members
  where room_id = v_room.id and profile_id = v_profile_id
  for update;

  if v_member.id is not null and v_member.status = 'active' then
    return query select v_room.id, v_member.id, false;
    return;
  end if;

  select count(*)
  into v_active_member_count
  from public.room_members
  where room_id = v_room.id and status = 'active';

  if v_active_member_count >= 6 then
    raise exception using errcode = 'P0001', message = 'ROOM_FULL';
  end if;

  if v_member.id is null then
    insert into public.room_members (
      room_id,
      profile_id,
      role,
      status,
      room_display_name
    )
    values (
      v_room.id,
      v_profile_id,
      'member',
      'active',
      btrim(p_room_display_name)
    )
    returning * into v_member;
  else
    update public.room_members
    set
      role = 'member',
      status = 'active',
      room_display_name = btrim(p_room_display_name),
      joined_at = now(),
      left_at = null
    where id = v_member.id
    returning * into v_member;
  end if;

  update public.room_invites
  set use_count = use_count + 1
  where id = v_invite.id;

  return query select v_room.id, v_member.id, true;
end;
$$;

revoke all on function public.create_room_invite(uuid, interval, smallint) from public, anon;
revoke all on function public.revoke_room_invite(uuid) from public, anon;
revoke all on function public.join_room_by_invite(text, text) from public, anon;

grant execute on function public.create_room_invite(uuid, interval, smallint) to authenticated;
grant execute on function public.revoke_room_invite(uuid) to authenticated;
grant execute on function public.join_room_by_invite(text, text) to authenticated;
