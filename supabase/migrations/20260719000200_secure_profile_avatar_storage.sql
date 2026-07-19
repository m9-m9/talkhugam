insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'avatars',
  'avatars',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.profiles
drop constraint if exists profiles_avatar_is_owner_avatar;

alter table public.profiles
add constraint profiles_avatar_is_owner_avatar
check (
  avatar_path is null
  or avatar_path = (id::text || '/avatar')
);

drop policy if exists avatars_select_own_or_shared_room on storage.objects;
drop policy if exists avatars_insert_own on storage.objects;
drop policy if exists avatars_update_own on storage.objects;
drop policy if exists avatars_delete_own on storage.objects;

create policy avatars_select_own_or_shared_room
on storage.objects
for select
to authenticated
using (
  bucket_id = 'avatars'
  and (
    name = ((select auth.uid())::text || '/avatar')
    or exists (
      select 1
      from public.profiles
      where profiles.id::text = split_part(storage.objects.name, '/', 1)
        and private.shares_active_room(profiles.id)
    )
  )
);

create policy avatars_insert_own
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and name = ((select auth.uid())::text || '/avatar')
);

create policy avatars_update_own
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and name = ((select auth.uid())::text || '/avatar')
)
with check (
  bucket_id = 'avatars'
  and name = ((select auth.uid())::text || '/avatar')
);

create policy avatars_delete_own
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and name = ((select auth.uid())::text || '/avatar')
);

comment on column public.profiles.avatar_path is
  'Private avatars Storage path in the fixed {profile_id}/avatar form; no public URL is stored.';
