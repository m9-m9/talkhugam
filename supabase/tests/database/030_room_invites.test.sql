begin;

\ir ../helpers/auth.inc

select plan(15);

select has_table('public', 'room_invites', 'room_invites table should exist');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.room_invites'::regclass),
  'room_invites should have RLS enabled'
);

select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000131',
  'invite-owner@test.local',
  '초대 방장'
);
select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000132',
  'invite-member@test.local',
  '초대 멤버'
);
select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000133',
  'invite-other@test.local',
  '다른 사용자'
);

insert into public.reading_rooms (id, name, created_by)
values (
  '10000000-0000-0000-0000-000000000031',
  '초대 테스트 방',
  '00000000-0000-0000-0000-000000000131'
);

insert into public.room_members (
  id,
  room_id,
  profile_id,
  role,
  room_display_name
)
values (
  '20000000-0000-0000-0000-000000000031',
  '10000000-0000-0000-0000-000000000031',
  '00000000-0000-0000-0000-000000000131',
  'owner',
  '초대 방장'
);

select tests.authenticate_as('00000000-0000-0000-0000-000000000131');

create temporary table test_invite as
select *
from public.create_room_invite(
  '10000000-0000-0000-0000-000000000031',
  interval '1 day',
  3::smallint
);

select is(
  (select char_length(code) from test_invite),
  6,
  'create_room_invite should return a six-character code'
);
select is(
  (select char_length(token) from test_invite),
  64,
  'create_room_invite should return a high-entropy link token'
);
select is(
  (
    select count(*)
    from public.room_invites as invite
    join test_invite as plain on plain.invite_id = invite.id
    where invite.code_hash = plain.code or invite.token_hash = plain.token
  ),
  0::bigint,
  'room_invites should never store plaintext invite values'
);

select tests.authenticate_as('00000000-0000-0000-0000-000000000132');

create temporary table first_join as
select *
from public.join_room_by_invite(
  (select code from test_invite),
  '초대 멤버'
);

select is((select joined from first_join), true, 'the first valid join should create a membership');
select is(
  (
    select status
    from public.room_members
    where profile_id = '00000000-0000-0000-0000-000000000132'
  ),
  'active'::public.member_status,
  'a joined profile should have an active membership'
);
select is(
  (select use_count from public.room_invites),
  1::smallint,
  'the first join should increment invite usage'
);
select is(
  (
    select joined
    from public.join_room_by_invite(
      (select code from test_invite),
      '초대 멤버'
    )
  ),
  false,
  'joining an already active membership should be idempotent'
);
select is(
  (select use_count from public.room_invites),
  1::smallint,
  'an idempotent join should not consume another invite use'
);

set local role authenticated;

select is(
  (select count(*) from public.room_invites),
  0::bigint,
  'a regular member should not select room invites'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000131');
set local role authenticated;

select is(
  (select count(*) from public.room_invites),
  1::bigint,
  'the room owner should select room invites'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000131');

select lives_ok(
  format(
    'select public.revoke_room_invite(%L::uuid)',
    (select invite_id from test_invite)
  ),
  'the room owner should revoke an invite'
);
select ok(
  (select revoked_at is not null from public.room_invites),
  'revoking should set revoked_at'
);

select tests.authenticate_as('00000000-0000-0000-0000-000000000133');

select throws_ok(
  format(
    'select * from public.join_room_by_invite(%L, %L)',
    (select token from test_invite),
    '다른 사용자'
  ),
  'P0001',
  'INVITE_REVOKED',
  'a revoked invite should reject new joins'
);

select * from finish();

rollback;
