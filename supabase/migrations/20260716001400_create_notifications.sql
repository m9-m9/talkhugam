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

create index notifications_recipient_created_at_idx
on public.notifications (recipient_profile_id, created_at desc, id desc);

create index notifications_recipient_unread_idx
on public.notifications (recipient_profile_id, created_at desc)
where read_at is null;

create index notifications_post_id_idx
on public.notifications (post_id)
where post_id is not null;

comment on table public.notifications is 'In-app notifications; message bodies are resolved from referenced records instead of duplicated';
