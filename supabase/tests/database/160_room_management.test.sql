begin;

\ir ../helpers/auth.inc

select plan(11);

select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000361',
  'management-owner@test.local',
  '관리 방장'
);
select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000362',
  'management-member@test.local',
  '관리 멤버'
);
select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000363',
  'management-stranger@test.local',
  '관리 외부 사용자'
);

insert into public.reading_rooms (id, name, description, created_by)
values (
  '10000000-0000-0000-0000-000000000361',
  '관리 테스트 독서방',
  '관리 기능 검증용 방',
  '00000000-0000-0000-0000-000000000361'
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
    '20000000-0000-0000-0000-000000000361',
    '10000000-0000-0000-0000-000000000361',
    '00000000-0000-0000-0000-000000000361',
    'owner',
    '관리 방장'
  ),
  (
    '20000000-0000-0000-0000-000000000362',
    '10000000-0000-0000-0000-000000000361',
    '00000000-0000-0000-0000-000000000362',
    'member',
    '관리 멤버'
  );

select has_function(
  'public',
  'remove_room_member',
  array['uuid', 'uuid'],
  'room management should expose a member removal RPC'
);
select has_function(
  'public',
  'get_my_archived_reading_rooms',
  array[]::text[],
  'room management should expose an archived room query RPC'
);

select tests.authenticate_as('00000000-0000-0000-0000-000000000362');
set local role authenticated;

select throws_ok(
  $$
    select public.remove_room_member(
      '10000000-0000-0000-0000-000000000361',
      '20000000-0000-0000-0000-000000000361'
    )
  $$,
  'P0001',
  'ROOM_FORBIDDEN',
  'a non-owner cannot remove a room owner'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000361');
set local role authenticated;

select lives_ok(
  $$
    select public.remove_room_member(
      '10000000-0000-0000-0000-000000000361',
      '20000000-0000-0000-0000-000000000362'
    )
  $$,
  'an owner can remove an active member'
);

reset role;

select is(
  (
    select status
    from public.room_members
    where id = '20000000-0000-0000-0000-000000000362'
  ),
  'removed'::public.member_status,
  'member removal should preserve a removed membership row'
);
select ok(
  (
    select left_at is not null
    from public.room_members
    where id = '20000000-0000-0000-0000-000000000362'
  ),
  'member removal should record the removal time'
);

select tests.authenticate_as('00000000-0000-0000-0000-000000000361');
set local role authenticated;

select throws_ok(
  $$
    select public.remove_room_member(
      '10000000-0000-0000-0000-000000000361',
      '20000000-0000-0000-0000-000000000361'
    )
  $$,
  'P0001',
  'ROOM_FORBIDDEN',
  'an owner cannot remove themselves through member removal'
);
select lives_ok(
  $$
    select public.leave_room('10000000-0000-0000-0000-000000000361', 'archive')
  $$,
  'a final owner can archive and leave their room'
);

reset role;

select ok(
  (
    select archived_at is not null
    from public.reading_rooms
    where id = '10000000-0000-0000-0000-000000000361'
  ),
  'archiving a room should record the archive time'
);

select tests.authenticate_as('00000000-0000-0000-0000-000000000361');
set local role authenticated;

select results_eq(
  $$
    select id, name, description
    from public.get_my_archived_reading_rooms()
  $$,
  $$
    values (
      '10000000-0000-0000-0000-000000000361'::uuid,
      '관리 테스트 독서방'::text,
      '관리 기능 검증용 방'::text
    )
  $$,
  'the archived room owner can retrieve their past room after leaving it'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000363');
set local role authenticated;

select is(
  (select count(*) from public.get_my_archived_reading_rooms()),
  0::bigint,
  'an unrelated user cannot retrieve another owner archive'
);

reset role;

select * from finish();

rollback;
