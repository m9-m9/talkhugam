create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name varchar(30) not null,
  avatar_path text,
  bio varchar(80),
  mbti varchar(4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_not_blank
    check (char_length(btrim(display_name)) between 1 and 30),
  constraint profiles_avatar_is_storage_path
    check (avatar_path is null or (char_length(avatar_path) between 1 and 500 and avatar_path !~ '^[a-z]+://')),
  constraint profiles_bio_length
    check (bio is null or char_length(bio) <= 80),
  constraint profiles_mbti_format
    check (mbti is null or mbti ~ '^[IE][NS][TF][JP]$')
);

create table public.notification_preferences (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  replies_enabled boolean not null default true,
  mentions_enabled boolean not null default true,
  room_events_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger notification_preferences_set_updated_at
before update on public.notification_preferences
for each row execute function private.set_updated_at();

create or replace function private.profile_display_name(p_user auth.users)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select left(
    coalesce(
      nullif(btrim(p_user.raw_user_meta_data ->> 'display_name'), ''),
      nullif(btrim(p_user.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(p_user.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(coalesce(p_user.email, ''), '@', 1), ''),
      'Talk후감 사용자'
    ),
    30
  );
$$;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, private.profile_display_name(new));

  insert into public.notification_preferences (profile_id)
  values (new.id);

  return new;
end;
$$;

revoke all on function private.profile_display_name(auth.users) from public, anon, authenticated;
revoke all on function private.handle_new_auth_user() from public, anon, authenticated;

create trigger auth_user_created_create_profile
after insert on auth.users
for each row execute function private.handle_new_auth_user();

comment on table public.profiles is 'Talk후감 global profile keyed by auth.users.id';
comment on column public.profiles.avatar_path is 'Private Supabase Storage object path, never a public URL';
comment on table public.notification_preferences is 'Phase 1 in-app notification category preferences';
