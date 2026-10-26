begin;

\ir ../helpers/auth.inc

select plan(35);

select has_table('public', 'room_bans', '오픈 책방 재입장 금지 테이블이 존재해야 한다');
select has_table('public', 'community_messages', '오픈 책방 자유 채팅 테이블이 존재해야 한다');
select has_table('public', 'content_reports', '신고 테이블이 존재해야 한다');
select ok((select relrowsecurity from pg_class where oid = 'public.community_messages'::regclass), '자유 채팅은 RLS를 활성화해야 한다');
select is(has_table_privilege('authenticated', 'public.community_messages', 'INSERT'), false, '자유 채팅은 RPC로만 작성해야 한다');
select is(has_table_privilege('authenticated', 'public.room_bans', 'SELECT'), false, '제재 원본은 멤버가 직접 조회할 수 없어야 한다');
select is(has_table_privilege('authenticated', 'public.content_reports', 'SELECT'), false, '신고 원본은 신고자가 직접 조회할 수 없어야 한다');
select has_function('public', 'create_community_room', '오픈 책방 생성 RPC가 존재해야 한다');
select has_function('public', 'join_community_room', '오픈 책방 입장 RPC가 존재해야 한다');
select has_function('public', 'send_community_message', '자유 채팅 작성 RPC가 존재해야 한다');
select has_function('public', 'ban_community_member', '오픈 책방 제재 RPC가 존재해야 한다');
select has_function('public', 'create_content_report', '신고 RPC가 존재해야 한다');

select tests.create_supabase_user('00000000-0000-0000-0000-000000000281', 'community-owner@test.local', '오픈 방장');
select tests.create_supabase_user('00000000-0000-0000-0000-000000000282', 'community-member@test.local', '오픈 멤버');
select tests.create_supabase_user('00000000-0000-0000-0000-000000000283', 'community-banned@test.local', '제재 멤버');
select tests.create_supabase_user('00000000-0000-0000-0000-000000000284', 'community-stranger@test.local', '오픈 외부');

select tests.authenticate_as('00000000-0000-0000-0000-000000000281');
set local role authenticated;

select lives_ok(
  $$select * from public.create_community_room('공개 오픈 책방', '자유 채팅', '방장', 'public', 3::smallint, null)$$,
  '방장은 1~100명 정원의 공개 오픈 책방을 만들 수 있어야 한다'
);

reset role;

select is(
  (select row(room_kind, access, capacity)::text from public.reading_rooms where name = '공개 오픈 책방'),
  '(community,public,3)',
  '공개 오픈 책방은 community/public/정원을 저장해야 한다'
);
select is(
  (select count(*) from public.reading_rooms where name = '공개 오픈 책방' and capacity = 3),
  1::bigint,
  '기존 private 기본값과 별도로 오픈 책방 정원을 저장해야 한다'
);

select tests.authenticate_as('00000000-0000-0000-0000-000000000284');
set local role authenticated;

select is((select count(*) from public.reading_rooms), 0::bigint, '외부 사용자는 원본 reading_rooms로 공개 오픈 책방을 직접 읽을 수 없어야 한다');
select is((select count(*) from public.list_community_rooms()), 1::bigint, '외부 사용자는 공개 RPC로 오픈 책방을 발견할 수 있어야 한다');
select lives_ok(
  $$select * from public.join_community_room((select id from public.list_community_rooms() where name = '공개 오픈 책방'), '외부')$$,
  '공개 오픈 책방은 로그인 사용자가 즉시 참여할 수 있어야 한다'
);
select lives_ok(
  $$select public.send_community_message((select id from public.list_community_rooms() where name = '공개 오픈 책방'), '첫 자유 채팅')$$,
  '활성 오픈 책방 멤버는 자유 채팅을 작성할 수 있어야 한다'
);
select is((select count(*) from public.community_messages), 1::bigint, '활성 멤버는 자유 채팅을 조회할 수 있어야 한다');
select is((select count(*) from public.profiles), 1::bigint, '같은 오픈 책방 멤버라도 원본 profiles RLS는 타인 프로필을 반환하지 않아야 한다');

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000281');
set local role authenticated;

select lives_ok(
  $$select * from public.create_community_room('비밀번호 오픈 책방', null, '방장', 'password', 3::smallint, 'secrets123')$$,
  '방장은 비밀번호 오픈 책방을 만들 수 있어야 한다'
);
select throws_ok(
  $$select public.create_room_invite((select id from public.list_community_rooms() where name = '비밀번호 오픈 책방'))$$,
  'P0001', 'ROOM_FORBIDDEN',
  '기존 초대 RPC는 오픈 책방에 사용할 수 없어야 한다'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000282');
set local role authenticated;

select throws_ok(
  $$select * from public.join_community_room((select id from public.list_community_rooms() where name = '비밀번호 오픈 책방'), '멤버', 'wrong-password')$$,
  'P0001', 'COMMUNITY_PASSWORD_INVALID',
  '잘못된 비밀번호는 입장을 거부해야 한다'
);
select lives_ok(
  $$select * from public.join_community_room((select id from public.list_community_rooms() where name = '비밀번호 오픈 책방'), '멤버', 'secrets123')$$,
  '올바른 비밀번호는 서버 검증 뒤 입장시켜야 한다'
);
select throws_ok(
  $$select * from private.community_room_access_secrets$$,
  '42501', null,
  '비밀번호 hash는 인증 사용자에게 직접 노출되지 않아야 한다'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000281');
set local role authenticated;

select lives_ok(
  $$select * from public.create_community_room('정원 한 명', null, '방장', 'public', 1::smallint, null)$$,
  '정원 1명 오픈 책방을 만들 수 있어야 한다'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000283');
set local role authenticated;

select throws_ok(
  $$select * from public.join_community_room((select id from public.list_community_rooms() where name = '정원 한 명'), '제재 멤버')$$,
  'P0001', 'ROOM_FULL',
  '오픈 책방 정원 도달 뒤 추가 입장을 거부해야 한다'
);
select lives_ok(
  $$select * from public.join_community_room((select id from public.list_community_rooms() where name = '공개 오픈 책방'), '제재 멤버')$$,
  '제재 전 멤버는 공개 오픈 책방에 참여할 수 있어야 한다'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000281');
set local role authenticated;

select lives_ok(
  $$select public.ban_community_member(
    (select id from public.list_community_rooms() where name = '공개 오픈 책방'),
    (select id from public.room_members where room_id = (select id from public.list_community_rooms() where name = '공개 오픈 책방') and profile_id = '00000000-0000-0000-0000-000000000283')
  )$$,
  '방장만 오픈 책방 멤버를 퇴장·재입장 금지할 수 있어야 한다'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000283');
set local role authenticated;

select throws_ok(
  $$select * from public.join_community_room((select id from public.list_community_rooms() where name = '공개 오픈 책방'), '제재 멤버')$$,
  'P0001', 'ROOM_BANNED',
  '제재된 멤버는 오픈 책방에 재입장할 수 없어야 한다'
);
select is((select count(*) from public.community_messages), 0::bigint, '제재된 멤버는 자유 채팅을 조회할 수 없어야 한다');

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000284');
set local role authenticated;

select lives_ok(
  $$select public.create_content_report('room', (select id from public.list_community_rooms() where name = '공개 오픈 책방'), '운영 확인 신고')$$,
  '로그인 사용자는 공개 오픈 책방을 신고할 수 있어야 한다'
);
select throws_ok(
  $$select * from public.content_reports$$,
  '42501', null,
  '신고자와 피신고자에게 신고 원본이 직접 노출되지 않아야 한다'
);

reset role;

select throws_ok(
  $$insert into public.reading_rooms (name, created_by, room_kind, access, capacity) values ('잘못된 private', '00000000-0000-0000-0000-000000000281', 'private', 'invite', 7)$$,
  '23514', null,
  '기존 비공개 책방은 최대 6명 제약을 데이터 모델에서도 유지해야 한다'
);

select * from finish();

rollback;
