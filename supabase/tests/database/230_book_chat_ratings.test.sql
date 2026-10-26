begin;

\ir ../helpers/auth.inc

select plan(13);

select has_table('public', 'book_chat_ratings', '별점 테이블이 존재해야 한다');
select hasnt_table('public', 'book_chat_completions', '완독 테이블은 제거되어야 한다');
select hasnt_table('public', 'book_chat_reading_progresses', '진행률 테이블은 제거되어야 한다');
select hasnt_column('public', 'book_chat_ratings', 'completed_at', '별점 기록에는 완독일이 없어야 한다');
select col_not_null('public', 'book_chat_ratings', 'rating', '별점은 필수여야 한다');
select hasnt_function('public', 'upsert_book_chat_completion', '완독 저장 함수는 제거되어야 한다');
select hasnt_function('public', 'upsert_book_chat_reading_progress', '진행률 저장 함수는 제거되어야 한다');

select tests.create_supabase_user('00000000-0000-0000-0000-000000000301', 'rating-owner@test.local', '별점 방장');
select tests.create_supabase_user('00000000-0000-0000-0000-000000000302', 'rating-stranger@test.local', '별점 외부');

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

select tests.authenticate_as('00000000-0000-0000-0000-000000000301');
set local role authenticated;

select throws_ok(
  $$select public.upsert_book_chat_rating('30000000-0000-0000-0000-000000000301', null::smallint, null)$$,
  'P0001', 'VALIDATION_FAILED', '별점 없이 저장할 수 없어야 한다'
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
select is(
  (select count(*) from public.notifications where type = 'completion'),
  0::bigint,
  '별점 저장은 알림을 만들지 않아야 한다'
);

select tests.authenticate_as('00000000-0000-0000-0000-000000000302');
set local role authenticated;
select throws_ok(
  $$select public.upsert_book_chat_rating('30000000-0000-0000-0000-000000000301', 3::smallint, null)$$,
  'P0001', 'ROOM_FORBIDDEN', '책방 멤버가 아니면 별점을 남길 수 없어야 한다'
);

reset role;
select * from finish();

rollback;
