-- 프로필 사진 객체 정책을 분리된 읽기 정책과 소유자 쓰기 정책으로 일관되게 복구한다.
drop policy if exists avatars_select_own_or_shared_room on storage.objects;
drop policy if exists avatars_select_own on storage.objects;
drop policy if exists avatars_select_shared_room on storage.objects;
drop policy if exists avatars_insert_own on storage.objects;
drop policy if exists avatars_update_own on storage.objects;
drop policy if exists avatars_delete_own on storage.objects;

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
    where storage.objects.name = (profiles.id::text || '/avatar')
      and private.shares_active_room(profiles.id)
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
