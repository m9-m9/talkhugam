drop policy if exists avatars_select_own_or_shared_room on storage.objects;
drop policy if exists avatars_select_own on storage.objects;
drop policy if exists avatars_select_shared_room on storage.objects;

create policy avatars_select_own
on storage.objects
for select
to authenticated
using (
  bucket_id = 'avatars'
  and name = ((select auth.uid())::text || '/avatar')
);

create policy avatars_select_shared_room
on storage.objects
for select
to authenticated
using (
  bucket_id = 'avatars'
  and exists (
    select 1
    from public.profiles
    where profiles.id::text = split_part(storage.objects.name, '/', 1)
      and private.shares_active_room(profiles.id)
  )
);
