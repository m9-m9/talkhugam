begin;

\ir ../helpers/auth.inc

select plan(8);

select has_function('public', 'get_community_room', '오픈 책방 상세 조회 RPC가 존재해야 한다');
select has_function('public', 'list_community_messages', '자유 채팅 목록 조회 RPC가 존재해야 한다');
select tests.create_supabase_user('00000000-0000-0000-0000-000000000291', 'community-read-owner@test.local', '방장');
select tests.create_supabase_user('00000000-0000-0000-0000-000000000292', 'community-read-member@test.local', '멤버');

select tests.authenticate_as('00000000-0000-0000-0000-000000000291');
set local role authenticated;
select lives_ok($$select * from public.create_community_room('조회 오픈 책방', null, '방장', 'public', 5)$$, '방장이 조회할 오픈 책방을 만들 수 있어야 한다');

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000292');
set local role authenticated;
select throws_ok(
  $$select * from public.get_community_room((select id from public.list_community_rooms() where name = '조회 오픈 책방'))$$,
  'P0001', 'ROOM_FORBIDDEN', '활성 멤버가 아닌 사용자는 상세 조회를 할 수 없어야 한다'
);
select lives_ok($$select * from public.join_community_room((select id from public.list_community_rooms() where name = '조회 오픈 책방'), '멤버')$$, '사용자는 공개 오픈 책방에 참여할 수 있어야 한다');
select is(
  (select array_agg(key order by key) from public.get_community_room((select id from public.list_community_rooms() where name = '조회 오픈 책방')) as room, lateral jsonb_object_keys(to_jsonb(room)) as key(key)),
  array['access', 'active_member_count', 'capacity', 'created_by', 'current_member_id', 'description', 'id', 'is_owner', 'name']::text[],
  '상세 RPC는 오픈 책방 표시와 본인 권한 필드만 반환해야 한다'
);
select lives_ok(
  $$select public.send_community_message((select id from public.list_community_rooms() where name = '조회 오픈 책방'), '읽기 RPC 검증 메시지')$$,
  '활성 멤버는 조회할 자유 채팅 메시지를 작성할 수 있어야 한다'
);
select is(
  (select count(*) from public.list_community_messages((select id from public.list_community_rooms() where name = '조회 오픈 책방'))),
  1::bigint,
  '활성 멤버는 제한된 자유 채팅 목록 RPC로 메시지를 조회할 수 있어야 한다'
);

reset role;
select * from finish();
rollback;
