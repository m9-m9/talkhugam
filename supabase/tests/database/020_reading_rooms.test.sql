begin;

\ir ../helpers/auth.inc

select plan(18);

select has_table('public', 'reading_rooms', 'reading_rooms table should exist');
select has_table('public', 'room_members', 'room_members table should exist');
select ok(
  (
    select indisunique
    from pg_index
    where indexrelid = 'public.room_members_one_active_owner'::regclass
  ),
  'an active room should have at most one owner'
);

select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000121',
  'room-owner@test.local',
  '방장'
);
select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000122',
  'room-member@test.local',
  '멤버'
);
select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000123',
  'room-stranger@test.local',
  '외부 사용자'
);

insert into public.reading_rooms (id, name, created_by)
values (
  '10000000-0000-0000-0000-000000000001',
  '테스트 독서방',
  '00000000-0000-0000-0000-000000000121'
);

insert into public.room_members (
  id,
  room_id,
  profile_id,
  role,
  room_display_name
)
values
  (
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000121',
    'owner',
    '방장'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000122',
    'member',
    '멤버'
  );

select throws_ok(
  $$
    insert into public.room_members (
      room_id,
      profile_id,
      role,
      room_display_name
    )
    values (
      '10000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000123',
      'owner',
      '두 번째 방장'
    )
  $$,
  '23505',
  null,
  'a room should reject a second active owner'
);

select tests.authenticate_as('00000000-0000-0000-0000-000000000121');
set local role authenticated;

select is(
  (select count(*) from public.profiles),
  2::bigint,
  'an owner should select self and active shared-room profiles'
);
select is(
  (select count(*) from public.reading_rooms),
  1::bigint,
  'an owner should select their room'
);
select is(
  (select count(*) from public.room_members),
  2::bigint,
  'an active member should select active members in the room'
);
select throws_ok(
  $$select public.leave_room('10000000-0000-0000-0000-000000000001')$$,
  'P0001',
  'OWNER_TRANSFER_REQUIRED',
  'an owner should transfer ownership before leaving a populated room'
);
select lives_ok(
  $$
    select public.transfer_room_ownership(
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000002'
    )
  $$,
  'an owner should transfer ownership to an active member'
);

reset role;

select is(
  (
    select role
    from public.room_members
    where id = '20000000-0000-0000-0000-000000000002'
  ),
  'owner'::public.member_role,
  'the target member should become owner'
);
select is(
  (
    select role
    from public.room_members
    where id = '20000000-0000-0000-0000-000000000001'
  ),
  'member'::public.member_role,
  'the previous owner should become a member'
);

select tests.authenticate_as('00000000-0000-0000-0000-000000000121');
set local role authenticated;

select lives_ok(
  $$select public.leave_room('10000000-0000-0000-0000-000000000001')$$,
  'a regular member should leave the room'
);

reset role;

select is(
  (
    select status
    from public.room_members
    where id = '20000000-0000-0000-0000-000000000001'
  ),
  'left'::public.member_status,
  'leaving should preserve a left membership row'
);

select tests.authenticate_as('00000000-0000-0000-0000-000000000123');
set local role authenticated;

select is(
  (select count(*) from public.reading_rooms),
  0::bigint,
  'a non-member should not select another room'
);
select is(
  (select count(*) from public.profiles),
  1::bigint,
  'a non-member should only select their own profile'
);
select lives_ok(
  $$
    select *
    from public.create_reading_room('외부 사용자의 방', null, '새 방장')
  $$,
  'a profile should create a room with an owner membership'
);
select is(
  (select count(*) from public.reading_rooms),
  1::bigint,
  'the room creator should select the new room'
);
select is(
  (
    select count(*)
    from public.room_members
    where role = 'owner' and status = 'active'
  ),
  1::bigint,
  'the new room should contain one active owner'
);

reset role;

select * from finish();

rollback;
