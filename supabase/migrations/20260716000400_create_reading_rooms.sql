create type public.room_status as enum ('active', 'archived', 'deleted');
create type public.member_role as enum ('owner', 'member');
create type public.member_status as enum ('active', 'left', 'removed');

create table public.reading_rooms (
  id uuid primary key default gen_random_uuid(),
  name varchar(40) not null,
  description varchar(120),
  status public.room_status not null default 'active',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  deleted_at timestamptz,
  constraint reading_rooms_name_not_blank
    check (char_length(btrim(name)) between 1 and 40),
  constraint reading_rooms_description_length
    check (description is null or char_length(description) <= 120),
  constraint reading_rooms_status_timestamps
    check (
      (status = 'active' and archived_at is null and deleted_at is null)
      or (status = 'archived' and archived_at is not null and deleted_at is null)
      or (status = 'deleted' and deleted_at is not null)
    )
);

create table public.room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.reading_rooms (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  role public.member_role not null default 'member',
  status public.member_status not null default 'active',
  room_display_name varchar(30) not null,
  room_avatar_path text,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  constraint room_members_display_name_not_blank
    check (char_length(btrim(room_display_name)) between 1 and 30),
  constraint room_members_avatar_is_storage_path
    check (
      room_avatar_path is null
      or (
        char_length(room_avatar_path) between 1 and 500
        and room_avatar_path !~ '^[a-z]+://'
      )
    ),
  constraint room_members_status_timestamps
    check (
      (status = 'active' and left_at is null)
      or (status in ('left', 'removed') and left_at is not null)
    ),
  constraint room_members_inactive_owner_forbidden
    check (status = 'active' or role = 'member')
);

create unique index room_members_room_profile_unique
on public.room_members (room_id, profile_id)
where profile_id is not null;

create unique index room_members_one_active_owner
on public.room_members (room_id)
where role = 'owner' and status = 'active';

create index room_members_room_status_idx
on public.room_members (room_id, status);

create index room_members_profile_status_idx
on public.room_members (profile_id, status)
where profile_id is not null;

create index reading_rooms_status_created_at_idx
on public.reading_rooms (status, created_at desc)
where deleted_at is null;

create trigger reading_rooms_set_updated_at
before update on public.reading_rooms
for each row execute function private.set_updated_at();

comment on table public.reading_rooms is 'Private reading rooms with at most six active members';
comment on column public.reading_rooms.created_by is 'Audit field only; owner authority comes from room_members.role';
comment on table public.room_members is 'Room-level role, display identity, and membership lifecycle';
