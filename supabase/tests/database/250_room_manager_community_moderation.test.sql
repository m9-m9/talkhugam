begin;

\ir ../helpers/auth.inc

select plan(14);

select tests.create_supabase_user('00000000-0000-0000-0000-000000000381', 'open-owner@test.local', '오픈 방장');
select tests.create_supabase_user('00000000-0000-0000-0000-000000000382', 'open-manager-a@test.local', '오픈 운영자 A');
select tests.create_supabase_user('00000000-0000-0000-0000-000000000383', 'open-manager-b@test.local', '오픈 운영자 B');
select tests.create_supabase_user('00000000-0000-0000-0000-000000000384', 'open-member@test.local', '오픈 참여자');
select tests.create_supabase_user('00000000-0000-0000-0000-000000000385', 'open-member-2@test.local', '오픈 참여자 2');
select tests.create_supabase_user('00000000-0000-0000-0000-000000000386', 'open-outsider@test.local', '오픈 외부');

insert into public.reading_rooms (id, name, created_by, room_kind, access, capacity)
values ('10000000-0000-0000-0000-000000000381', '운영자 오픈 책방', '00000000-0000-0000-0000-000000000381', 'community', 'public', 10::smallint);

insert into public.room_members (id, room_id, profile_id, role, room_display_name)
values
  ('20000000-0000-0000-0000-000000000381', '10000000-0000-0000-0000-000000000381', '00000000-0000-0000-0000-000000000381', 'owner', '오픈 방장'),
  ('20000000-0000-0000-0000-000000000382', '10000000-0000-0000-0000-000000000381', '00000000-0000-0000-0000-000000000382', 'manager', '오픈 운영자 A'),
  ('20000000-0000-0000-0000-000000000383', '10000000-0000-0000-0000-000000000381', '00000000-0000-0000-0000-000000000383', 'manager', '오픈 운영자 B'),
  ('20000000-0000-0000-0000-000000000384', '10000000-0000-0000-0000-000000000381', '00000000-0000-0000-0000-000000000384', 'member', '오픈 참여자'),
  ('20000000-0000-0000-0000-000000000385', '10000000-0000-0000-0000-000000000381', '00000000-0000-0000-0000-000000000385', 'member', '오픈 참여자 2');

insert into public.community_messages (room_id, sender_member_id, body)
values
  ('10000000-0000-0000-0000-000000000381', '20000000-0000-0000-0000-000000000381', '방장 공지'),
  ('10000000-0000-0000-0000-000000000381', '20000000-0000-0000-0000-000000000383', '운영자 안내'),
  ('10000000-0000-0000-0000-000000000381', '20000000-0000-0000-0000-000000000384', '참여자 인사');

-- 운영자 A
select tests.authenticate_as('00000000-0000-0000-0000-000000000382');
set local role authenticated;

select is(
  (select current_member_role from public.get_community_room('10000000-0000-0000-0000-000000000381')),
  'manager'::public.member_role,
  '오픈 책방 상세는 현재 멤버의 운영자 역할을 반환해야 한다'
);
select is(
  (select is_owner from public.get_community_room('10000000-0000-0000-0000-000000000381')),
  false,
  '운영자는 is_owner가 false여야 한다'
);
select is(
  (select array_agg(sender_role::text order by sender_role::text) from public.list_community_messages('10000000-0000-0000-0000-000000000381')),
  array['manager', 'member', 'owner']::text[],
  '자유 채팅 목록은 보낸 사람 역할을 반환해야 한다'
);
select throws_ok(
  $$select public.ban_community_member('10000000-0000-0000-0000-000000000381', '20000000-0000-0000-0000-000000000383')$$,
  'P0001', 'ROOM_FORBIDDEN',
  '운영자는 다른 운영자를 제재할 수 없어야 한다'
);
select throws_ok(
  $$select public.ban_community_member('10000000-0000-0000-0000-000000000381', '20000000-0000-0000-0000-000000000381')$$,
  'P0001', 'ROOM_FORBIDDEN',
  '운영자는 방장을 제재할 수 없어야 한다'
);
select throws_ok(
  $$select public.ban_community_member('10000000-0000-0000-0000-000000000381', '20000000-0000-0000-0000-000000000382')$$,
  'P0001', 'ROOM_FORBIDDEN',
  '운영자는 자기 자신을 제재할 수 없어야 한다'
);
select lives_ok(
  $$select public.ban_community_member('10000000-0000-0000-0000-000000000381', '20000000-0000-0000-0000-000000000384')$$,
  '운영자는 참여자를 퇴장·차단할 수 있어야 한다'
);

reset role;

select is(
  (select row(role, status)::text from public.room_members where id = '20000000-0000-0000-0000-000000000384'),
  '(member,removed)',
  '운영자가 제재한 참여자는 removed로 기록되어야 한다'
);
select is(
  (select banned_by_member_id from public.room_bans where room_id = '10000000-0000-0000-0000-000000000381' and profile_id = '00000000-0000-0000-0000-000000000384'),
  '20000000-0000-0000-0000-000000000382'::uuid,
  '제재 기록은 실행한 운영자 멤버를 남겨야 한다'
);

-- 참여자
select tests.authenticate_as('00000000-0000-0000-0000-000000000385');
set local role authenticated;

select throws_ok(
  $$select public.ban_community_member('10000000-0000-0000-0000-000000000381', '20000000-0000-0000-0000-000000000383')$$,
  'P0001', 'ROOM_FORBIDDEN',
  '참여자는 다른 멤버를 제재할 수 없어야 한다'
);

reset role;

-- 외부 사용자
select tests.authenticate_as('00000000-0000-0000-0000-000000000386');
set local role authenticated;

select throws_ok(
  $$select public.ban_community_member('10000000-0000-0000-0000-000000000381', '20000000-0000-0000-0000-000000000385')$$,
  'P0001', 'ROOM_FORBIDDEN',
  '외부 사용자는 오픈 책방 멤버를 제재할 수 없어야 한다'
);

reset role;

-- 방장
select tests.authenticate_as('00000000-0000-0000-0000-000000000381');
set local role authenticated;

select lives_ok(
  $$select public.ban_community_member('10000000-0000-0000-0000-000000000381', '20000000-0000-0000-0000-000000000383')$$,
  '방장은 운영자를 퇴장·차단할 수 있어야 한다'
);
select is(
  (select current_member_role from public.get_community_room('10000000-0000-0000-0000-000000000381')),
  'owner'::public.member_role,
  '방장의 오픈 책방 상세 역할은 owner여야 한다'
);

reset role;

select is(
  (select row(role, status)::text from public.room_members where id = '20000000-0000-0000-0000-000000000383'),
  '(member,removed)',
  '방장이 제재한 운영자는 member 역할로 비활성화되어야 한다'
);

select * from finish();

rollback;
