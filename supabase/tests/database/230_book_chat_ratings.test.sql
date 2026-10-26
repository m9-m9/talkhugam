begin;

\ir ../helpers/auth.inc

select plan(28);

select has_table('public', 'book_chat_ratings', '별점 테이블이 존재해야 한다');
select hasnt_table('public', 'book_chat_completions', '완독 테이블은 제거되어야 한다');
select hasnt_table('public', 'book_chat_reading_progresses', '진행률 테이블은 제거되어야 한다');
select hasnt_column('public', 'book_chat_ratings', 'completed_at', '별점 기록에는 완독일이 없어야 한다');
select col_not_null('public', 'book_chat_ratings', 'rating', '별점은 필수여야 한다');
select hasnt_function('public', 'upsert_book_chat_completion', '완독 저장 함수는 제거되어야 한다');
select hasnt_function('public', 'remove_book_chat_completion', '완독 삭제 함수는 제거되어야 한다');
select hasnt_function('public', 'upsert_book_chat_reading_progress', '진행률 저장 함수는 제거되어야 한다');

select tests.create_supabase_user('00000000-0000-0000-0000-000000000301', 'rating-owner@test.local', '별점 방장');
select tests.create_supabase_user('00000000-0000-0000-0000-000000000302', 'rating-stranger@test.local', '별점 외부');
select tests.create_supabase_user('00000000-0000-0000-0000-000000000303', 'rating-member@test.local', '별점 멤버');

insert into public.reading_rooms (id, name, created_by)
values ('10000000-0000-0000-0000-000000000301', '별점 테스트 모임', '00000000-0000-0000-0000-000000000301');
insert into public.room_members (id, room_id, profile_id, role, room_display_name)
values (
  '20000000-0000-0000-0000-000000000301',
  '10000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000301',
  'owner',
  '별점 방장'
);

insert into public.room_members (id, room_id, profile_id, role, room_display_name)
values (
  '20000000-0000-0000-0000-000000000303',
  '10000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000303',
  'member',
  '별점 멤버'
);

insert into public.books (id, source, title, authors)
values (
  '40000000-0000-0000-0000-000000000301',
  'manual',
  '별점 테스트 책',
  array['테스트 작가']
);

insert into public.book_chats (id, room_id, book_id, name)
values (
  '30000000-0000-0000-0000-000000000301',
  '10000000-0000-0000-0000-000000000301',
  '40000000-0000-0000-0000-000000000301',
  '별점 테스트 책 대화'
);

create temp table notifications_before as select count(*) as total from public.notifications;

select tests.authenticate_as('00000000-0000-0000-0000-000000000301');
set local role authenticated;

select throws_ok(
  $$select public.upsert_book_chat_rating('30000000-0000-0000-0000-000000000301', null::smallint, null)$$,
  'P0001', 'VALIDATION_FAILED', '별점 없이 저장할 수 없어야 한다'
);
select throws_ok(
  $$select public.upsert_book_chat_rating('30000000-0000-0000-0000-000000000301', 0::smallint, null)$$,
  'P0001', 'VALIDATION_FAILED', '별점 0은 저장할 수 없어야 한다'
);
select throws_ok(
  $$select public.upsert_book_chat_rating('30000000-0000-0000-0000-000000000301', 6::smallint, null)$$,
  'P0001', 'VALIDATION_FAILED', '별점 6은 저장할 수 없어야 한다'
);
select throws_ok(
  $$select public.upsert_book_chat_rating('30000000-0000-0000-0000-000000000301', 4::smallint, repeat('가', 1001))$$,
  'P0001', 'VALIDATION_FAILED', '1001자 총평은 저장할 수 없어야 한다'
);
select lives_ok(
  $$select public.upsert_book_chat_rating('30000000-0000-0000-0000-000000000301', 4::smallint, '좋았어요')$$,
  '활성 멤버는 별점을 저장할 수 있어야 한다'
);
select lives_ok(
  $$select public.upsert_book_chat_rating('30000000-0000-0000-0000-000000000301', 5::smallint, null)$$,
  '같은 책의 별점은 수정되어야 한다'
);
select results_eq(
  $$select rating, review from public.book_chat_ratings where book_chat_id = '30000000-0000-0000-0000-000000000301'$$,
  $$values (5::smallint, null::text)$$,
  '별점과 총평이 마지막 값으로 바뀌어야 한다'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000303');
set local role authenticated;
select lives_ok(
  $$select public.upsert_book_chat_rating('30000000-0000-0000-0000-000000000301', 3::smallint, null)$$,
  '다른 멤버도 같은 책에 별점을 저장할 수 있어야 한다'
);
select is(
  (select count(*) from public.book_chat_ratings where profile_id = '00000000-0000-0000-0000-000000000301'),
  1::bigint,
  '같은 책방 멤버는 다른 멤버의 별점을 조회할 수 있어야 한다'
);

reset role;
select is(
  (select count(*) from public.notifications),
  (select total from notifications_before),
  '별점 저장은 알림을 만들지 않아야 한다'
);

select tests.authenticate_as('00000000-0000-0000-0000-000000000302');
set local role authenticated;
select throws_ok(
  $$select public.upsert_book_chat_rating('30000000-0000-0000-0000-000000000301', 3::smallint, null)$$,
  'P0001', 'ROOM_FORBIDDEN', '책방 멤버가 아니면 별점을 남길 수 없어야 한다'
);

select is(
  (select count(*) from public.book_chat_ratings),
  0::bigint,
  '책방 외부 사용자는 별점을 조회할 수 없어야 한다'
);
select throws_ok(
  $$select public.remove_book_chat_rating('30000000-0000-0000-0000-000000000301')$$,
  'P0001', 'ROOM_FORBIDDEN', '책방 멤버가 아니면 별점을 삭제할 수 없어야 한다'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000301');
set local role authenticated;
select lives_ok(
  $$select public.remove_book_chat_rating('30000000-0000-0000-0000-000000000301')$$,
  '활성 멤버는 자신의 별점을 삭제할 수 있어야 한다'
);

reset role;
select is(
  (select count(*) from public.book_chat_ratings where profile_id = '00000000-0000-0000-0000-000000000301'),
  0::bigint,
  '본인 별점이 삭제되어야 한다'
);
select is(
  (select count(*) from public.book_chat_ratings where profile_id = '00000000-0000-0000-0000-000000000303'),
  1::bigint,
  '다른 멤버의 별점은 삭제되지 않아야 한다'
);

insert into public.book_chat_ratings (book_chat_id, profile_id, rating, review)
values ('30000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000301', 5, '보관 전 별점');

update public.book_chats
set status = 'archived', archived_at = now()
where id = '30000000-0000-0000-0000-000000000301';

select tests.authenticate_as('00000000-0000-0000-0000-000000000301');
set local role authenticated;
select throws_ok(
  $$select public.upsert_book_chat_rating('30000000-0000-0000-0000-000000000301', 4::smallint, '수정 불가')$$,
  'P0001', 'BOOK_CHAT_ARCHIVED', '보관된 책 대화의 별점은 수정할 수 없어야 한다'
);
select throws_ok(
  $$select public.remove_book_chat_rating('30000000-0000-0000-0000-000000000301')$$,
  'P0001', 'BOOK_CHAT_ARCHIVED', '보관된 책 대화의 별점은 삭제할 수 없어야 한다'
);

reset role;
select hasnt_table('private', 'book_chat_completions_backup_20261026', '완독 기록은 백업 없이 삭제되어야 한다');
select hasnt_table('private', 'book_chat_reading_progresses_backup_20261026', '진행률 기록은 백업 없이 삭제되어야 한다');

select * from finish();

rollback;
