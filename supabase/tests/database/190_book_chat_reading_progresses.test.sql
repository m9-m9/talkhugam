begin;

\ir ../helpers/auth.inc

select plan(12);

select has_table(
  'public',
  'book_chat_reading_progresses',
  'personal book reading progress table should exist'
);
select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.book_chat_reading_progresses'::regclass
  ),
  'personal reading progresses should enable RLS'
);
select has_function(
  'public',
  'upsert_book_chat_reading_progress',
  array['uuid', 'integer', 'integer'],
  'personal reading progress upsert function should exist'
);

select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000191',
  'progress-owner@test.local',
  '진행률 방장'
);
select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000192',
  'progress-stranger@test.local',
  '진행률 외부 사용자'
);

insert into public.reading_rooms (id, name, created_by)
values ('10000000-0000-0000-0000-000000000191', '진행률 테스트 책방', '00000000-0000-0000-0000-000000000191');
insert into public.room_members (id, room_id, profile_id, role, room_display_name)
values ('20000000-0000-0000-0000-000000000191', '10000000-0000-0000-0000-000000000191', '00000000-0000-0000-0000-000000000191', 'owner', '진행률 방장');
insert into public.books (id, source, title, authors)
values ('30000000-0000-0000-0000-000000000191', 'manual', '진행률 테스트 책', array['테스트 작가']);
insert into public.book_chats (id, room_id, book_id, name)
values ('40000000-0000-0000-0000-000000000191', '10000000-0000-0000-0000-000000000191', '30000000-0000-0000-0000-000000000191', '진행률 테스트 책 대화');

select tests.authenticate_as('00000000-0000-0000-0000-000000000191');
set local role authenticated;

select lives_ok(
  $$ select public.upsert_book_chat_reading_progress('40000000-0000-0000-0000-000000000191', 87, 320) $$,
  'an active member should save personal reading progress'
);
select is(
  (select current_page from public.book_chat_reading_progresses where book_chat_id = '40000000-0000-0000-0000-000000000191'),
  87,
  'the current page should persist'
);
select throws_ok(
  $$ select public.upsert_book_chat_reading_progress('40000000-0000-0000-0000-000000000191', 321, 320) $$,
  'P0001',
  'VALIDATION_FAILED',
  'a page beyond the total should be rejected'
);
select lives_ok(
  $$ select public.upsert_book_chat_completion('40000000-0000-0000-0000-000000000191', 5::smallint, '끝까지 읽었어요.') $$,
  'completion should be saved for the active member'
);
select is(
  (select current_page from public.book_chat_reading_progresses where book_chat_id = '40000000-0000-0000-0000-000000000191'),
  320,
  'completion should update an existing personal progress to the final page'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000192');
set local role authenticated;

select is(
  (select count(*) from public.book_chat_reading_progresses),
  0::bigint,
  'a non-member should not read another member personal progress'
);
select throws_ok(
  $$ select public.upsert_book_chat_reading_progress('40000000-0000-0000-0000-000000000191', 12, 320) $$,
  'P0001',
  'ROOM_FORBIDDEN',
  'a non-member should not save personal progress'
);

reset role;
delete from public.book_chat_reading_progresses
where book_chat_id = '40000000-0000-0000-0000-000000000191';
select tests.authenticate_as('00000000-0000-0000-0000-000000000191');
set local role authenticated;
select lives_ok(
  $$ select public.upsert_book_chat_completion('40000000-0000-0000-0000-000000000191', null, null) $$,
  'completion should save without a prior progress record'
);
select is(
  (select count(*) from public.book_chat_reading_progresses),
  0::bigint,
  'completion should not create a personal progress record when none exists'
);

reset role;
select * from finish();

rollback;
