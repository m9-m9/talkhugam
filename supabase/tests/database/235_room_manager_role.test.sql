begin;

\ir ../helpers/auth.inc

select plan(37);

select has_function(
  'public', 'update_room_member_role', array['uuid', 'uuid', 'member_role'],
  '방장 역할 변경 RPC가 존재해야 한다'
);
select has_function(
  'private', 'can_manage_room_content', array['uuid'],
  '콘텐츠 관리 권한 helper가 존재해야 한다'
);
select has_function(
  'public', 'get_my_room_role', array['uuid'],
  '내 책방 역할 조회 RPC가 존재해야 한다'
);
select ok(
  'manager' = any(enum_range(null::public.member_role)::text[]),
  'member_role에 manager 값이 있어야 한다'
);

select tests.create_supabase_user('00000000-0000-0000-0000-000000000351', 'role-owner@test.local', '역할 방장');
select tests.create_supabase_user('00000000-0000-0000-0000-000000000352', 'role-manager@test.local', '역할 운영자');
select tests.create_supabase_user('00000000-0000-0000-0000-000000000353', 'role-member@test.local', '역할 참여자');
select tests.create_supabase_user('00000000-0000-0000-0000-000000000354', 'role-outsider@test.local', '역할 외부');
select tests.create_supabase_user('00000000-0000-0000-0000-000000000355', 'role-former@test.local', '역할 이전 멤버');
select tests.create_supabase_user('00000000-0000-0000-0000-000000000356', 'role-leaving@test.local', '역할 탈퇴 운영자');

insert into public.reading_rooms (id, name, created_by)
values (
  '10000000-0000-0000-0000-000000000351',
  '운영자 역할 테스트 책방',
  '00000000-0000-0000-0000-000000000351'
);

insert into public.room_members (id, room_id, profile_id, role, status, room_display_name, left_at)
values
  ('20000000-0000-0000-0000-000000000351', '10000000-0000-0000-0000-000000000351', '00000000-0000-0000-0000-000000000351', 'owner', 'active', '역할 방장', null),
  ('20000000-0000-0000-0000-000000000352', '10000000-0000-0000-0000-000000000351', '00000000-0000-0000-0000-000000000352', 'member', 'active', '역할 운영자', null),
  ('20000000-0000-0000-0000-000000000353', '10000000-0000-0000-0000-000000000351', '00000000-0000-0000-0000-000000000353', 'member', 'active', '역할 참여자', null),
  ('20000000-0000-0000-0000-000000000355', '10000000-0000-0000-0000-000000000351', '00000000-0000-0000-0000-000000000355', 'member', 'left', '역할 이전 멤버', now()),
  ('20000000-0000-0000-0000-000000000356', '10000000-0000-0000-0000-000000000351', '00000000-0000-0000-0000-000000000356', 'member', 'active', '역할 탈퇴 운영자', null);

-- 방장: 승격과 거부 규칙
select tests.authenticate_as('00000000-0000-0000-0000-000000000351');
set local role authenticated;

select lives_ok(
  $$select public.update_room_member_role('10000000-0000-0000-0000-000000000351', '20000000-0000-0000-0000-000000000352', 'manager')$$,
  '방장은 참여자를 운영자로 바꿀 수 있어야 한다'
);
select throws_ok(
  $$select public.update_room_member_role('10000000-0000-0000-0000-000000000351', '20000000-0000-0000-0000-000000000353', 'owner')$$,
  'P0001', 'VALIDATION_FAILED',
  '역할 변경으로 방장을 넘길 수 없어야 한다'
);
select throws_ok(
  $$select public.update_room_member_role('10000000-0000-0000-0000-000000000351', '20000000-0000-0000-0000-000000000351', 'member')$$,
  'P0001', 'ROOM_FORBIDDEN',
  '방장 자신의 역할은 바꿀 수 없어야 한다'
);
select throws_ok(
  $$select public.update_room_member_role('10000000-0000-0000-0000-000000000351', '20000000-0000-0000-0000-000000000355', 'manager')$$,
  'P0001', 'ROOM_FORBIDDEN',
  '활성 멤버가 아니면 역할을 바꿀 수 없어야 한다'
);
select is(
  public.get_my_room_role('10000000-0000-0000-0000-000000000351'),
  'owner'::public.member_role,
  '방장의 역할 조회 결과는 owner여야 한다'
);

reset role;

select is(
  (select role from public.room_members where id = '20000000-0000-0000-0000-000000000352'),
  'manager'::public.member_role,
  '승격된 멤버는 manager로 저장되어야 한다'
);
select is(
  (select count(*) from public.notifications where recipient_profile_id = '00000000-0000-0000-0000-000000000352'),
  0::bigint,
  '운영자 지정은 알림을 만들지 않아야 한다'
);

-- 운영자: 콘텐츠 권한은 있고 방장 전용 동작은 거부
select tests.authenticate_as('00000000-0000-0000-0000-000000000352');
set local role authenticated;

select is(
  public.get_my_room_role('10000000-0000-0000-0000-000000000351'),
  'manager'::public.member_role,
  '운영자의 역할 조회 결과는 manager여야 한다'
);
select ok(
  private.can_manage_room_content('10000000-0000-0000-0000-000000000351'),
  '운영자는 콘텐츠 관리 권한이 있어야 한다'
);
select throws_ok(
  $$select public.update_room_member_role('10000000-0000-0000-0000-000000000351', '20000000-0000-0000-0000-000000000353', 'manager')$$,
  'P0001', 'ROOM_FORBIDDEN',
  '운영자는 다른 멤버의 역할을 바꿀 수 없어야 한다'
);
select throws_ok(
  $$select public.remove_room_member('10000000-0000-0000-0000-000000000351', '20000000-0000-0000-0000-000000000353')$$,
  'P0001', 'ROOM_FORBIDDEN',
  '운영자는 멤버를 내보낼 수 없어야 한다'
);
select throws_ok(
  $$select public.transfer_room_ownership('10000000-0000-0000-0000-000000000351', '20000000-0000-0000-0000-000000000353')$$,
  'P0001', 'ROOM_FORBIDDEN',
  '운영자는 방장을 넘길 수 없어야 한다'
);
select throws_ok(
  $$select public.delete_reading_room('10000000-0000-0000-0000-000000000351', '운영자 역할 테스트 책방')$$,
  'P0001', 'ROOM_FORBIDDEN',
  '운영자는 책방을 삭제할 수 없어야 한다'
);
select lives_ok(
  $$update public.reading_rooms set name = '운영자가 바꾼 이름' where id = '10000000-0000-0000-0000-000000000351'$$,
  '운영자의 책방 설정 수정 시도는 RLS로 조용히 걸러져야 한다'
);

reset role;

select is(
  (select name::text from public.reading_rooms where id = '10000000-0000-0000-0000-000000000351'),
  '운영자 역할 테스트 책방',
  '운영자는 책방 이름을 바꿀 수 없어야 한다'
);

-- 참여자
select tests.authenticate_as('00000000-0000-0000-0000-000000000353');
set local role authenticated;

select is(
  public.get_my_room_role('10000000-0000-0000-0000-000000000351'),
  'member'::public.member_role,
  '참여자의 역할 조회 결과는 member여야 한다'
);
select ok(
  not private.can_manage_room_content('10000000-0000-0000-0000-000000000351'),
  '참여자는 콘텐츠 관리 권한이 없어야 한다'
);
select throws_ok(
  $$select public.update_room_member_role('10000000-0000-0000-0000-000000000351', '20000000-0000-0000-0000-000000000353', 'manager')$$,
  'P0001', 'ROOM_FORBIDDEN',
  '참여자는 자신을 운영자로 바꿀 수 없어야 한다'
);

reset role;

-- 외부 사용자
select tests.authenticate_as('00000000-0000-0000-0000-000000000354');
set local role authenticated;

select ok(
  public.get_my_room_role('10000000-0000-0000-0000-000000000351') is null,
  '외부 사용자의 역할 조회 결과는 null이어야 한다'
);
select ok(
  not private.can_manage_room_content('10000000-0000-0000-0000-000000000351'),
  '외부 사용자는 콘텐츠 관리 권한이 없어야 한다'
);
select throws_ok(
  $$select public.update_room_member_role('10000000-0000-0000-0000-000000000351', '20000000-0000-0000-0000-000000000353', 'manager')$$,
  'P0001', 'ROOM_FORBIDDEN',
  '외부 사용자는 역할을 바꿀 수 없어야 한다'
);

reset role;

-- 방장: 해제와 재지정
select tests.authenticate_as('00000000-0000-0000-0000-000000000351');
set local role authenticated;

select lives_ok(
  $$select public.update_room_member_role('10000000-0000-0000-0000-000000000351', '20000000-0000-0000-0000-000000000352', 'member')$$,
  '방장은 운영자를 참여자로 되돌릴 수 있어야 한다'
);

reset role;

select is(
  (select role from public.room_members where id = '20000000-0000-0000-0000-000000000352'),
  'member'::public.member_role,
  '되돌린 역할은 member로 저장되어야 한다'
);

select tests.authenticate_as('00000000-0000-0000-0000-000000000351');
set local role authenticated;

select lives_ok(
  $$select public.update_room_member_role('10000000-0000-0000-0000-000000000351', '20000000-0000-0000-0000-000000000352', 'manager')$$,
  '방장은 같은 멤버를 다시 운영자로 지정할 수 있어야 한다'
);
select lives_ok(
  $$select public.update_room_member_role('10000000-0000-0000-0000-000000000351', '20000000-0000-0000-0000-000000000356', 'manager')$$,
  '방장은 여러 명을 운영자로 지정할 수 있어야 한다'
);

reset role;

-- 운영자가 나가면 비활성 check를 지키며 member로 남아야 한다
select tests.authenticate_as('00000000-0000-0000-0000-000000000352');
set local role authenticated;

select lives_ok(
  $$select public.leave_room('10000000-0000-0000-0000-000000000351')$$,
  '운영자는 방장 이양 없이 책방을 나갈 수 있어야 한다'
);

reset role;

select is(
  (select row(role, status)::text from public.room_members where id = '20000000-0000-0000-0000-000000000352'),
  '(member,left)',
  '나간 운영자는 member 역할로 기록되어야 한다'
);

-- 운영자의 계정 삭제 준비
select tests.authenticate_as('00000000-0000-0000-0000-000000000356');
set local role authenticated;

select lives_ok(
  $$select * from public.prepare_account_deletion('anonymize', '60000000-0000-0000-0000-000000000356')$$,
  '운영자는 방장 이양 없이 계정 삭제를 준비할 수 있어야 한다'
);

reset role;

select is(
  (select row(role, status)::text from public.room_members where id = '20000000-0000-0000-0000-000000000356'),
  '(member,left)',
  '계정 삭제를 준비한 운영자는 member 역할로 비활성화되어야 한다'
);

-- 운영자에게 방장 이양
select tests.authenticate_as('00000000-0000-0000-0000-000000000351');
set local role authenticated;

select lives_ok(
  $$select public.update_room_member_role('10000000-0000-0000-0000-000000000351', '20000000-0000-0000-0000-000000000353', 'manager')$$,
  '방장은 이양 전에 참여자를 운영자로 지정할 수 있어야 한다'
);
select lives_ok(
  $$select public.transfer_room_ownership('10000000-0000-0000-0000-000000000351', '20000000-0000-0000-0000-000000000353')$$,
  '방장은 운영자에게 방장을 넘길 수 있어야 한다'
);

reset role;

select is(
  (select role from public.room_members where id = '20000000-0000-0000-0000-000000000353'),
  'owner'::public.member_role,
  '방장을 넘겨받은 운영자는 owner가 되어야 한다'
);
select is(
  (select role from public.room_members where id = '20000000-0000-0000-0000-000000000351'),
  'member'::public.member_role,
  '이전 방장은 member가 되어야 한다'
);

select * from finish();

rollback;
