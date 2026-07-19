begin;

\ir ../helpers/auth.inc

select plan(9);

select ok(
  exists (select 1 from storage.buckets where id = 'avatars'),
  'private avatars bucket should exist'
);
select is(
  (select file_size_limit from storage.buckets where id = 'avatars'),
  5242880::bigint,
  'avatars bucket should limit files to 5MB'
);
select is(
  (select allowed_mime_types from storage.buckets where id = 'avatars'),
  array['image/jpeg', 'image/png', 'image/webp']::text[],
  'avatars bucket should only accept the supported image MIME types'
);

select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000181',
  'avatar-owner@test.local',
  '사진 주인'
);
select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000182',
  'avatar-member@test.local',
  '같은 책방 멤버'
);
select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000183',
  'avatar-stranger@test.local',
  '외부 사용자'
);

insert into public.reading_rooms (id, name, created_by)
values ('10000000-0000-0000-0000-000000000181', '사진 공유 책방', '00000000-0000-0000-0000-000000000181');

insert into public.room_members (id, room_id, profile_id, role, room_display_name)
values
  (
    '20000000-0000-0000-0000-000000000181',
    '10000000-0000-0000-0000-000000000181',
    '00000000-0000-0000-0000-000000000181',
    'owner',
    '사진 주인'
  ),
  (
    '20000000-0000-0000-0000-000000000182',
    '10000000-0000-0000-0000-000000000181',
    '00000000-0000-0000-0000-000000000182',
    'member',
    '같은 책방 멤버'
  );

insert into storage.objects (bucket_id, name, owner, metadata)
values (
  'avatars',
  'profiles/00000000-0000-0000-0000-000000000181/avatar',
  '00000000-0000-0000-0000-000000000181',
  '{"mimetype":"image/png"}'::jsonb
);

select tests.authenticate_as('00000000-0000-0000-0000-000000000182');
set local role authenticated;

select is(
  (select count(*) from public.profiles where id = '00000000-0000-0000-0000-000000000181'),
  1::bigint,
  'an active same-room member should read the owner profile'
);
select is(
  (select count(*) from storage.objects where bucket_id = 'avatars'),
  1::bigint,
  'an active same-room member should read the owner avatar'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000183');
set local role authenticated;

select is_empty(
  $$
    select id
    from public.profiles
    where id = '00000000-0000-0000-0000-000000000181'
  $$,
  'a user outside the room should not read the owner profile'
);
select is_empty(
  $$
    select id
    from storage.objects
    where bucket_id = 'avatars'
  $$,
  'a user outside the room should not read the owner avatar'
);
select throws_ok(
  $$
    insert into storage.objects (bucket_id, name, owner, metadata)
    values (
      'avatars',
      'profiles/00000000-0000-0000-0000-000000000181/avatar',
      '00000000-0000-0000-0000-000000000183',
      '{"mimetype":"image/png"}'::jsonb
    )
  $$,
  '42501',
  null,
  'a user should not upload an avatar into another profile directory'
);
select throws_ok(
  $$
    update public.profiles
    set avatar_path = 'profiles/00000000-0000-0000-0000-000000000181/avatar'
    where id = '00000000-0000-0000-0000-000000000183'
  $$,
  '42501',
  null,
  'a user should not reference another profile avatar path'
);

reset role;
select * from finish();

rollback;
