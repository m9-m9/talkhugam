insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
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

drop policy if exists profiles_select_self on public.profiles;
drop policy if exists profiles_select_self_or_shared_room on public.profiles;
drop policy if exists profiles_select_self_or_active_room_member on public.profiles;
drop policy if exists profiles_update_self on public.profiles;

create policy profiles_select_self_or_shared_room
on public.profiles
for select
to authenticated
using (
  (select auth.uid()) = id
  or private.shares_active_room(id)
);

create policy profiles_update_self
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check (
  (select auth.uid()) = id
  and (
    avatar_path is null
    or avatar_path = concat('profiles/', (select auth.uid()::text), '/avatar')
  )
);

create policy avatars_select_self_or_active_room_member
on storage.objects
for select
to authenticated
using (
  bucket_id = 'avatars'
  and name like 'profiles/%/avatar'
  and (
    (storage.foldername(name))[2] = (select auth.uid()::text)
    or exists (
      select 1
      from public.room_members as viewer
      join public.room_members as profile_member
        on profile_member.room_id = viewer.room_id
      join public.reading_rooms as room
        on room.id = viewer.room_id
      where viewer.profile_id = (select auth.uid())
        and viewer.status = 'active'
        and profile_member.profile_id::text = (storage.foldername(storage.objects.name))[2]
        and profile_member.status = 'active'
        and room.deleted_at is null
    )
  )
);

create policy avatars_insert_self
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and name = concat('profiles/', (select auth.uid()::text), '/avatar')
);

create policy avatars_update_self
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and name = concat('profiles/', (select auth.uid()::text), '/avatar')
)
with check (
  bucket_id = 'avatars'
  and name = concat('profiles/', (select auth.uid()::text), '/avatar')
);

create policy avatars_delete_self
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and name = concat('profiles/', (select auth.uid()::text), '/avatar')
);

comment on policy profiles_select_self_or_shared_room on public.profiles is
  '본인 또는 같은 활성 책방 멤버만 프로필과 avatar_path를 조회한다.';
