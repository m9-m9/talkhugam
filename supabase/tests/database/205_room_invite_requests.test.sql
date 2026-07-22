begin;

\ir ../helpers/auth.inc

select plan(7);

select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000205',
  'invite-request-owner@test.local',
  '초대 요청 방장'
);
select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000206',
  'invite-request-member@test.local',
  '초대 요청 멤버'
);
select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000207',
  'invite-request-outsider@test.local',
  '초대 요청 외부 사용자'
);

insert into public.reading_rooms (id, name, created_by)
values (
  '10000000-0000-0000-0000-000000000205',
  '초대 요청 테스트 책방',
  '00000000-0000-0000-0000-000000000205'
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
    '20000000-0000-0000-0000-000000000205',
    '10000000-0000-0000-0000-000000000205',
    '00000000-0000-0000-0000-000000000205',
    'owner',
    '초대 요청 방장'
  ),
  (
    '20000000-0000-0000-0000-000000000206',
    '10000000-0000-0000-0000-000000000205',
    '00000000-0000-0000-0000-000000000206',
    'member',
    '초대 요청 멤버'
  );

select tests.authenticate_as('00000000-0000-0000-0000-000000000206');

select is(
  public.request_room_invite('10000000-0000-0000-0000-000000000205'),
  true,
  'an active member should request an invite from the owner'
);
select is(
  (
    select count(*)
    from public.notifications
    where recipient_profile_id = '00000000-0000-0000-0000-000000000205'
      and actor_member_id = '20000000-0000-0000-0000-000000000206'
      and room_id = '10000000-0000-0000-0000-000000000205'
      and type = 'invite_request'
  ),
  1::bigint,
  'the owner should receive one invite request notification'
);
select ok(
  (
    select read_at is null
    from public.notifications
    where recipient_profile_id = '00000000-0000-0000-0000-000000000205'
      and type = 'invite_request'
  ),
  'a new invite request should remain unread for the owner'
);
select is(
  public.request_room_invite('10000000-0000-0000-0000-000000000205'),
  false,
  'an unread invite request should not be duplicated'
);

select tests.authenticate_as('00000000-0000-0000-0000-000000000205');
select throws_ok(
  $$select public.request_room_invite('10000000-0000-0000-0000-000000000205')$$,
  'P0001',
  'ROOM_OWNER_CANNOT_REQUEST_INVITE',
  'an owner should not request their own room invite'
);

select tests.authenticate_as('00000000-0000-0000-0000-000000000207');
select throws_ok(
  $$select public.request_room_invite('10000000-0000-0000-0000-000000000205')$$,
  'P0001',
  'ROOM_FORBIDDEN',
  'an outsider should not request an invite for another bookshop'
);

select tests.authenticate_as(null);
select throws_ok(
  $$select public.request_room_invite('10000000-0000-0000-0000-000000000205')$$,
  'P0001',
  'AUTH_REQUIRED',
  'an anonymous visitor should not request an invite'
);

select * from finish();

rollback;
