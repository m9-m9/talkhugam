begin;

\ir ../helpers/auth.inc

select plan(13);

select has_table('public', 'profiles', 'profiles table should exist');
select has_table(
  'public',
  'notification_preferences',
  'notification_preferences table should exist'
);
select col_is_pk('public', 'profiles', 'id', 'profiles.id should be the primary key');
select col_is_fk('public', 'profiles', 'id', 'profiles.id should reference auth.users');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'profiles should have RLS enabled'
);
select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.notification_preferences'::regclass
  ),
  'notification_preferences should have RLS enabled'
);

select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000111',
  'owner@test.local',
  '방장'
);
select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000112',
  'stranger@test.local',
  '외부 사용자'
);

select is(
  (
    select display_name
    from public.profiles
    where id = '00000000-0000-0000-0000-000000000111'
  ),
  '방장',
  'auth user trigger should copy the display name'
);
select is(
  (
    select count(*)
    from public.notification_preferences
    where profile_id = '00000000-0000-0000-0000-000000000111'
  ),
  1::bigint,
  'auth user trigger should create notification preferences'
);
select throws_ok(
  $$
    update public.profiles
    set mbti = 'XXXX'
    where id = '00000000-0000-0000-0000-000000000111'
  $$,
  '23514',
  null,
  'invalid MBTI should violate a check constraint'
);

select tests.authenticate_as('00000000-0000-0000-0000-000000000111');
set local role authenticated;

select is(
  (select count(*) from public.profiles),
  1::bigint,
  'an authenticated user should only select their own profile before room membership exists'
);
select lives_ok(
  $$
    update public.profiles
    set bio = '천천히 읽고 오래 남겨요'
    where id = '00000000-0000-0000-0000-000000000111'
  $$,
  'a user should update their own profile'
);
select is(
  (
    select bio
    from public.profiles
    where id = '00000000-0000-0000-0000-000000000111'
  ),
  '천천히 읽고 오래 남겨요',
  'the own profile update should persist'
);
select is_empty(
  $$
    update public.profiles
    set bio = '수정 시도'
    where id = '00000000-0000-0000-0000-000000000112'
    returning id
  $$,
  'a user should not update another profile'
);

reset role;

select * from finish();

rollback;
