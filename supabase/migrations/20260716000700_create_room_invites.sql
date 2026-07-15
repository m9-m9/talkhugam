create table public.room_invites (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.reading_rooms (id) on delete cascade,
  created_by_member_id uuid not null references public.room_members (id),
  code_hash text not null,
  token_hash text not null,
  expires_at timestamptz not null,
  max_uses smallint,
  use_count smallint not null default 0,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint room_invites_code_hash_format
    check (code_hash ~ '^[0-9a-f]{64}$'),
  constraint room_invites_token_hash_format
    check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint room_invites_expiry_after_creation
    check (expires_at > created_at),
  constraint room_invites_max_uses_positive
    check (max_uses is null or max_uses between 1 and 20),
  constraint room_invites_use_count_valid
    check (use_count >= 0 and (max_uses is null or use_count <= max_uses))
);

create unique index room_invites_active_code_hash_unique
on public.room_invites (code_hash)
where revoked_at is null;

create unique index room_invites_active_token_hash_unique
on public.room_invites (token_hash)
where revoked_at is null;

create index room_invites_room_created_at_idx
on public.room_invites (room_id, created_at desc);

create index room_invites_expires_at_idx
on public.room_invites (expires_at)
where revoked_at is null;

comment on table public.room_invites is 'Hashed room codes and link tokens; plaintext is returned once and never stored';
