begin;

\ir ../helpers/auth.inc

select plan(20);

select has_table('public', 'follows', '팔로우 관계 테이블이 존재해야 한다');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.follows'::regclass),
  '팔로우 관계 테이블은 RLS를 활성화해야 한다'
);
select is(
  has_table_privilege('authenticated', 'public.follows', 'SELECT'),
  false,
  '인증 사용자는 팔로우 관계를 직접 조회할 수 없어야 한다'
);
select has_function('public', 'follow_profile', '팔로우 RPC가 존재해야 한다');
select has_function('public', 'unfollow_profile', '언팔로우 RPC가 존재해야 한다');
select has_function('public', 'get_public_profile', '공개 프로필 RPC가 존재해야 한다');
select has_function('public', 'list_public_profile_followers', '공개 팔로워 목록 RPC가 존재해야 한다');

select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000251',
  'follow-owner@test.local',
  '팔로우 사용자 A'
);
select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000252',
  'follow-target@test.local',
  '팔로우 사용자 B'
);

update public.profiles
set bio = '공개 소개', avatar_path = '00000000-0000-0000-0000-000000000252/avatar'
where id = '00000000-0000-0000-0000-000000000252';

select tests.authenticate_as('00000000-0000-0000-0000-000000000251');
set local role authenticated;

select is(
  (select count(*) from public.profiles),
  1::bigint,
  '팔로우 전에도 원본 profiles RLS는 타인의 프로필을 반환하지 않아야 한다'
);
select throws_ok(
  $$select public.follow_profile('00000000-0000-0000-0000-000000000251')$$,
  'P0001',
  'SELF_FOLLOW_FORBIDDEN',
  '자기 자신 팔로우는 거부해야 한다'
);
select is(
  public.follow_profile('00000000-0000-0000-0000-000000000252'),
  true,
  '현재 사용자는 다른 공개 프로필을 팔로우할 수 있어야 한다'
);
select is(
  public.follow_profile('00000000-0000-0000-0000-000000000252'),
  false,
  '중복 팔로우는 새 관계를 만들지 않아야 한다'
);
select is(
  (
    select array_agg(key order by key)
    from public.get_public_profile('00000000-0000-0000-0000-000000000252') as public_profile,
      lateral jsonb_object_keys(to_jsonb(public_profile)) as key(key)
  ),
  array['avatar_path', 'bio', 'display_name', 'follower_count', 'id', 'is_following']::text[],
  '공개 프로필 RPC는 id, 표시 이름, 소개, 아바타 경로, 팔로워 수, 팔로우 여부만 반환해야 한다'
);
select is(
  (
    select follower_count
    from public.get_public_profile('00000000-0000-0000-0000-000000000252')
  ),
  1::bigint,
  '공개 프로필은 팔로워 수를 반환해야 한다'
);
select is(
  (
    select is_following
    from public.get_public_profile('00000000-0000-0000-0000-000000000252')
  ),
  true,
  '공개 프로필은 현재 사용자의 팔로우 상태를 반환해야 한다'
);
select is(
  (
    select array_agg(key order by key)
    from public.list_public_profile_followers('00000000-0000-0000-0000-000000000252') as public_profile,
      lateral jsonb_object_keys(to_jsonb(public_profile)) as key(key)
  ),
  array['avatar_path', 'bio', 'display_name', 'follower_count', 'id', 'is_following']::text[],
  '공개 팔로워 목록 RPC도 허용된 필드만 반환해야 한다'
);
select throws_ok(
  $$select * from public.follows$$,
  '42501',
  null,
  '팔로우 관계 원본은 직접 조회할 수 없어야 한다'
);
select is(
  public.unfollow_profile('00000000-0000-0000-0000-000000000252'),
  true,
  '현재 사용자는 자신의 팔로우 관계를 해제할 수 있어야 한다'
);
select is(
  public.unfollow_profile('00000000-0000-0000-0000-000000000252'),
  false,
  '없는 팔로우 해제는 관계를 만들지 않아야 한다'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000252');
set local role authenticated;

select is(
  (
    select array_agg(id order by id)
    from public.list_public_profile_followers('00000000-0000-0000-0000-000000000252')
  ),
  null::uuid[],
  '언팔로우 뒤 공개 팔로워 목록은 관계를 반환하지 않아야 한다'
);

reset role;

set local role anon;
select throws_ok(
  $$select * from public.get_public_profile('00000000-0000-0000-0000-000000000252')$$,
  '42501',
  null,
  '익명 사용자는 공개 프로필 RPC를 실행할 수 없어야 한다'
);

reset role;

select * from finish();

rollback;
