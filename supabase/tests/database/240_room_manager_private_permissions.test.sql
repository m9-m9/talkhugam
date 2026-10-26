begin;

\ir ../helpers/auth.inc

select plan(23);

select tests.create_supabase_user('00000000-0000-0000-0000-000000000371', 'private-owner@test.local', '비공개 방장');
select tests.create_supabase_user('00000000-0000-0000-0000-000000000372', 'private-manager@test.local', '비공개 운영자');
select tests.create_supabase_user('00000000-0000-0000-0000-000000000373', 'private-member@test.local', '비공개 참여자');
select tests.create_supabase_user('00000000-0000-0000-0000-000000000374', 'private-outsider@test.local', '비공개 외부');

insert into public.reading_rooms (id, name, created_by)
values ('10000000-0000-0000-0000-000000000371', '운영 권한 책방', '00000000-0000-0000-0000-000000000371');

insert into public.reading_rooms (id, name, created_by, room_kind, access, capacity)
values ('10000000-0000-0000-0000-000000000372', '운영 권한 오픈 책방', '00000000-0000-0000-0000-000000000371', 'community', 'public', 10::smallint);

insert into public.room_members (id, room_id, profile_id, role, room_display_name)
values
  ('20000000-0000-0000-0000-000000000371', '10000000-0000-0000-0000-000000000371', '00000000-0000-0000-0000-000000000371', 'owner', '비공개 방장'),
  ('20000000-0000-0000-0000-000000000372', '10000000-0000-0000-0000-000000000371', '00000000-0000-0000-0000-000000000372', 'manager', '비공개 운영자'),
  ('20000000-0000-0000-0000-000000000373', '10000000-0000-0000-0000-000000000371', '00000000-0000-0000-0000-000000000373', 'member', '비공개 참여자'),
  ('20000000-0000-0000-0000-000000000374', '10000000-0000-0000-0000-000000000372', '00000000-0000-0000-0000-000000000371', 'owner', '오픈 방장'),
  ('20000000-0000-0000-0000-000000000375', '10000000-0000-0000-0000-000000000372', '00000000-0000-0000-0000-000000000372', 'manager', '오픈 운영자');

insert into public.books (id, source, title)
values ('40000000-0000-0000-0000-000000000371', 'manual', '운영 권한 책');

insert into public.book_chats (id, room_id, book_id, created_by_member_id, name)
values ('30000000-0000-0000-0000-000000000371', '10000000-0000-0000-0000-000000000371', '40000000-0000-0000-0000-000000000371', '20000000-0000-0000-0000-000000000371', '운영 권한 책');

insert into public.room_invites (id, room_id, created_by_member_id, code_hash, token_hash, expires_at)
values
  ('50000000-0000-0000-0000-000000000371', '10000000-0000-0000-0000-000000000371', '20000000-0000-0000-0000-000000000371', repeat('1', 64), repeat('2', 64), now() + interval '1 day'),
  ('50000000-0000-0000-0000-000000000372', '10000000-0000-0000-0000-000000000371', '20000000-0000-0000-0000-000000000371', repeat('3', 64), repeat('4', 64), now() + interval '1 day');

select is(
  (select array_agg(policyname::text order by policyname) from pg_policies where schemaname = 'public' and tablename = 'room_invites'),
  array['room_invites_select_room_content_manager']::text[],
  '초대 조회 정책은 방장·운영자 기준 하나여야 한다'
);

-- 방장
select tests.authenticate_as('00000000-0000-0000-0000-000000000371');
set local role authenticated;

select lives_ok(
  $$select * from public.create_room_invite('10000000-0000-0000-0000-000000000371', interval '1 day', 1::smallint)$$,
  '방장은 초대 코드를 만들 수 있어야 한다'
);

reset role;

-- 운영자
select tests.authenticate_as('00000000-0000-0000-0000-000000000372');
set local role authenticated;

select lives_ok(
  $$select * from public.create_room_invite('10000000-0000-0000-0000-000000000371', interval '1 day', 1::smallint)$$,
  '운영자는 비공개 책방 초대 코드를 만들 수 있어야 한다'
);
select is(
  (select count(*) from public.room_invites),
  4::bigint,
  '운영자는 책방 초대 목록을 조회할 수 있어야 한다'
);
select lives_ok(
  $$select public.revoke_room_invite('50000000-0000-0000-0000-000000000371')$$,
  '운영자는 초대 코드를 폐기할 수 있어야 한다'
);
select throws_ok(
  $$select public.request_room_invite('10000000-0000-0000-0000-000000000371')$$,
  'P0001', 'ROOM_MANAGER_CANNOT_REQUEST_INVITE',
  '운영자는 초대를 직접 만들 수 있으므로 요청하지 않아야 한다'
);
select lives_ok(
  $$select public.set_book_chat_status('30000000-0000-0000-0000-000000000371', 'archived')$$,
  '운영자는 책 대화를 보관할 수 있어야 한다'
);
select throws_ok(
  $$select * from public.create_room_invite('10000000-0000-0000-0000-000000000372', interval '1 day', 1::smallint)$$,
  'P0001', 'ROOM_FORBIDDEN',
  '오픈 책방에서는 운영자도 초대 코드를 만들 수 없어야 한다'
);

reset role;

select is(
  (select count(*) from public.room_invites where room_id = '10000000-0000-0000-0000-000000000371' and created_by_member_id = '20000000-0000-0000-0000-000000000372'),
  1::bigint,
  '운영자가 만든 초대는 운영자 멤버로 기록되어야 한다'
);
select ok(
  (select revoked_at is not null from public.room_invites where id = '50000000-0000-0000-0000-000000000371'),
  '운영자가 폐기한 초대는 폐기 시각을 가져야 한다'
);
select is(
  (select status from public.book_chats where id = '30000000-0000-0000-0000-000000000371'),
  'archived'::public.book_chat_status,
  '운영자가 보관한 책 대화는 archived여야 한다'
);

-- 참여자
select tests.authenticate_as('00000000-0000-0000-0000-000000000373');
set local role authenticated;

select throws_ok(
  $$select * from public.create_room_invite('10000000-0000-0000-0000-000000000371', interval '1 day', 1::smallint)$$,
  'P0001', 'ROOM_FORBIDDEN',
  '참여자는 초대 코드를 만들 수 없어야 한다'
);
select is(
  (select count(*) from public.room_invites),
  0::bigint,
  '참여자는 초대 목록을 조회할 수 없어야 한다'
);
select throws_ok(
  $$select public.revoke_room_invite('50000000-0000-0000-0000-000000000372')$$,
  'P0001', 'ROOM_FORBIDDEN',
  '참여자는 초대 코드를 폐기할 수 없어야 한다'
);
select throws_ok(
  $$select public.set_book_chat_status('30000000-0000-0000-0000-000000000371', 'reading')$$,
  'P0001', 'ROOM_FORBIDDEN',
  '참여자는 책 대화 상태를 바꿀 수 없어야 한다'
);
select is(
  public.request_room_invite('10000000-0000-0000-0000-000000000371'),
  true,
  '참여자는 초대를 요청할 수 있어야 한다'
);

reset role;

select is(
  (
    select array_agg(recipient_profile_id::text order by recipient_profile_id)
    from public.notifications
    where type = 'invite_request'
      and actor_member_id = '20000000-0000-0000-0000-000000000373'
  ),
  array['00000000-0000-0000-0000-000000000371', '00000000-0000-0000-0000-000000000372']::text[],
  '초대 요청은 방장과 운영자 모두에게 전달되어야 한다'
);

-- 외부 사용자
select tests.authenticate_as('00000000-0000-0000-0000-000000000374');
set local role authenticated;

select throws_ok(
  $$select * from public.create_room_invite('10000000-0000-0000-0000-000000000371', interval '1 day', 1::smallint)$$,
  'P0001', 'ROOM_FORBIDDEN',
  '외부 사용자는 초대 코드를 만들 수 없어야 한다'
);
select throws_ok(
  $$select public.revoke_room_invite('50000000-0000-0000-0000-000000000372')$$,
  'P0001', 'ROOM_FORBIDDEN',
  '외부 사용자는 초대 코드를 폐기할 수 없어야 한다'
);
select throws_ok(
  $$select public.set_book_chat_status('30000000-0000-0000-0000-000000000371', 'reading')$$,
  'P0001', 'ROOM_FORBIDDEN',
  '외부 사용자는 책 대화 상태를 바꿀 수 없어야 한다'
);

reset role;

-- 방장은 기존처럼 모두 할 수 있다
select tests.authenticate_as('00000000-0000-0000-0000-000000000371');
set local role authenticated;

select lives_ok(
  $$select public.set_book_chat_status('30000000-0000-0000-0000-000000000371', 'reading')$$,
  '방장은 보관한 책 대화를 다시 열 수 있어야 한다'
);
select lives_ok(
  $$select public.revoke_room_invite('50000000-0000-0000-0000-000000000372')$$,
  '방장은 초대 코드를 폐기할 수 있어야 한다'
);

reset role;

select is(
  (select status from public.book_chats where id = '30000000-0000-0000-0000-000000000371'),
  'reading'::public.book_chat_status,
  '방장이 다시 연 책 대화는 reading이어야 한다'
);

select * from finish();

rollback;
