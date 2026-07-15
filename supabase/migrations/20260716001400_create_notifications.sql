create type public.notification_type as enum (
  'reply',
  'mention',
  'invite',
  'removed',
  'ownership_transfer',
  'system'
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid not null references public.profiles (id) on delete cascade,
  actor_member_id uuid references public.room_members (id) on delete set null,
  room_id uuid references public.reading_rooms (id) on delete cascade,
  post_id uuid references public.posts (id) on delete cascade,
  type public.notification_type not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_read_time_order
    check (read_at is null or read_at >= created_at),
  constraint notifications_context_required
    check (
      type = 'system'
      or room_id is not null
      or post_id is not null
    )
);

create table public.notification_preferences (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  replies_enabled boolean not null default true,
  mentions_enabled boolean not null default true,
  room_events_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create index notifications_recipient_created_at_idx
on public.notifications (recipient_profile_id, created_at desc, id desc);

create index notifications_recipient_unread_idx
on public.notifications (recipient_profile_id, created_at desc)
where read_at is null;

create index notifications_post_id_idx
on public.notifications (post_id)
where post_id is not null;

create trigger notification_preferences_set_updated_at
before update on public.notification_preferences
for each row execute function private.set_updated_at();

insert into public.notification_preferences (profile_id)
select id from public.profiles
on conflict (profile_id) do nothing;

create or replace function private.create_notification_preferences()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.notification_preferences (profile_id)
  values (new.id)
  on conflict (profile_id) do nothing;

  return new;
end;
$$;

create trigger profiles_create_notification_preferences
after insert on public.profiles
for each row execute function private.create_notification_preferences();

revoke all on function private.create_notification_preferences() from public, anon, authenticated;

comment on table public.notifications is 'In-app notifications; message bodies are resolved from referenced records instead of duplicated';
comment on table public.notification_preferences is 'Phase 1 in-app notification category preferences';
