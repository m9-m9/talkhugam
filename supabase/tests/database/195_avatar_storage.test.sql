begin;

\ir ../helpers/auth.inc

select plan(10);

select is(
  (select public from storage.buckets where id = 'avatars'),
  false,
  '프로필 사진 버킷은 public URL을 제공하지 않는다'
);
select is(
  (select file_size_limit from storage.buckets where id = 'avatars'),
  5242880::bigint,
  '프로필 사진은 5MB 이하로 제한한다'
);
select is(
  (select allowed_mime_types from storage.buckets where id = 'avatars'),
  array['image/jpeg', 'image/png', 'image/webp']::text[],
  '프로필 사진은 JPG, PNG, WebP만 허용한다'
);
select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname in (
        'avatars_select_own',
        'avatars_select_shared_room',
        'avatars_insert_own',
        'avatars_update_own',
        'avatars_delete_own'
      )
  ),
  5::bigint,
  '프로필 사진 객체에는 직접 읽기·공유 읽기·소유자 쓰기 정책이 모두 있다'
);

select tests.create_supabase_user(
  '00000000-0000-4000-8000-000000000181',
  'avatar-owner@test.local',
  '사진 주인'
);
select tests.create_supabase_user(
  '00000000-0000-4000-8000-000000000182',
  'avatar-stranger@test.local',
  '외부 사용자'
);
select tests.create_supabase_user(
  '00000000-0000-4000-8000-000000000183',
  'avatar-shared-member@test.local',
  '같은 책방 멤버'
);

select throws_ok(
  $$
    update public.profiles
    set avatar_path = 'not-my-avatar/avatar'
    where id = '00000000-0000-4000-8000-000000000181'
  $$,
  '23514',
  null,
  '프로필 사진 경로는 자신의 고정 객체 경로여야 한다'
);

insert into public.reading_rooms (id, name, created_by)
values (
  '10000000-0000-4000-8000-000000000181',
  '프로필 사진 책방',
  '00000000-0000-4000-8000-000000000181'
);

insert into public.room_members (room_id, profile_id, role, room_display_name)
values
  (
    '10000000-0000-4000-8000-000000000181',
    '00000000-0000-4000-8000-000000000181',
    'owner',
    '사진 주인'
  ),
  (
    '10000000-0000-4000-8000-000000000181',
    '00000000-0000-4000-8000-000000000183',
    'member',
    '같은 책방 멤버'
  );

insert into storage.objects (bucket_id, name, owner_id)
values (
  'avatars',
  '00000000-0000-4000-8000-000000000181/avatar',
  '00000000-0000-4000-8000-000000000181'
);

insert into storage.objects (bucket_id, name, owner_id)
values (
  'avatars',
  '00000000-0000-4000-8000-000000000181/preview',
  '00000000-0000-4000-8000-000000000181'
);

select tests.authenticate_as('00000000-0000-4000-8000-000000000181');
set local role authenticated;

select is(
  (select count(*) from storage.objects where bucket_id = 'avatars'),
  1::bigint,
  '사진 주인은 자신의 사진을 읽을 수 있다'
);
select lives_ok(
  $$
    update storage.objects
    set metadata = jsonb_build_object('mimetype', 'image/png')
    where bucket_id = 'avatars'
      and name = '00000000-0000-4000-8000-000000000181/avatar'
  $$,
  '사진 주인은 동일한 객체 경로를 교체할 수 있다'
);

reset role;
select tests.authenticate_as('00000000-0000-4000-8000-000000000183');
set local role authenticated;

select is(
  (select count(*) from storage.objects where bucket_id = 'avatars'),
  1::bigint,
  '같은 책방의 활성 멤버는 프로필 사진을 읽을 수 있다'
);

reset role;
select tests.authenticate_as('00000000-0000-4000-8000-000000000182');
set local role authenticated;

select is_empty(
  $$ select * from storage.objects where bucket_id = 'avatars' $$,
  '책방을 함께하지 않는 사용자는 다른 사람의 사진을 읽을 수 없다'
);
select throws_ok(
  $$
    insert into storage.objects (bucket_id, name, owner_id)
    values (
      'avatars',
      '00000000-0000-4000-8000-000000000181/avatar',
      '00000000-0000-4000-8000-000000000182'
    )
  $$,
  '42501',
  null,
  '다른 사용자의 프로필 사진 경로에는 쓸 수 없다'
);

reset role;
select * from finish();

rollback;
