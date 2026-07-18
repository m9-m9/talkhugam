begin;

\ir ../helpers/auth.inc

select plan(11);

select has_table(
  'public',
  'book_chat_reading_progresses',
  'reading progress table should exist'
);
select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.book_chat_reading_progresses'::regclass
  ),
  'reading progress should enable RLS'
);
select has_index(
  'public',
  'book_chat_reading_progresses',
  'book_chat_reading_progresses_profile_updated_at_idx',
  'my reading books should have an ordered profile index'
);
select has_function(
  'public',
  'upsert_book_chat_reading_progress',
  array['uuid', 'integer', 'integer'],
  'reading progress upsert function should exist'
);

select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000191',
  'progress-owner@test.local',
  '진행률 방장'
);
select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000192',
  'progress-member@test.local',
  '진행률 멤버'
);
select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000193',
  'progress-stranger@test.local',
  '진행률 외부 사용자'
);

insert into public.reading_rooms (id, name, created_by)
values (
  '10000000-0000-0000-0000-000000000191',
  '진행률 테스트 책방',
  '00000000-0000-0000-0000-000000000191'
);

insert into public.room_members (id, room_id, profile_id, role, room_display_name)
values
  (
    '20000000-0000-0000-0000-000000000191',
    '10000000-0000-0000-0000-000000000191',
    '00000000-0000-0000-0000-000000000191',
    'owner',
    '진행률 방장'
  ),
  (
    '20000000-0000-0000-0000-000000000192',
    '10000000-0000-0000-0000-000000000191',
    '00000000-0000-0000-0000-000000000192',
    'member',
    '진행률 멤버'
  );

insert into public.books (id, source, title, authors)
values (
  '30000000-0000-0000-0000-000000000191',
  'manual',
  '진행률 테스트 책',
  array['테스트 작가']
);

insert into public.book_chats (id, room_id, book_id, name)
values (
  '40000000-0000-0000-0000-000000000191',
  '10000000-0000-0000-0000-000000000191',
  '30000000-0000-0000-0000-000000000191',
  '진행률 테스트 책 대화'
);

select tests.authenticate_as('00000000-0000-0000-0000-000000000191');
set local role authenticated;

select lives_ok(
  $$
    select public.upsert_book_chat_reading_progress(
      '40000000-0000-0000-0000-000000000191',
      87,
      320
    )
  $$,
  'an active member should record personal reading progress'
);
select is(
  (
    select current_page
    from public.book_chat_reading_progresses
    where book_chat_id = '40000000-0000-0000-0000-000000000191'
      and profile_id = '00000000-0000-0000-0000-000000000191'
  ),
  87,
  'a progress record should persist the current page'
);
select is(
  (
    select total_pages
    from public.book_chat_reading_progresses
    where book_chat_id = '40000000-0000-0000-0000-000000000191'
      and profile_id = '00000000-0000-0000-0000-000000000191'
  ),
  320,
  'a progress record should persist the total pages'
);
select throws_ok(
  $$
    select public.upsert_book_chat_reading_progress(
      '40000000-0000-0000-0000-000000000191',
      321,
      320
    )
  $$,
  'P0001',
  'VALIDATION_FAILED',
  'a page beyond the total should be rejected'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000192');
set local role authenticated;

select is(
  (select count(*) from public.book_chat_reading_progresses),
  0::bigint,
  'another room member should not see another member progress'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000193');
set local role authenticated;

select is(
  (select count(*) from public.book_chat_reading_progresses),
  0::bigint,
  'a user outside the room should not see progress'
);
select throws_ok(
  $$
    select public.upsert_book_chat_reading_progress(
      '40000000-0000-0000-0000-000000000191',
      10,
      320
    )
  $$,
  'P0001',
  'ROOM_FORBIDDEN',
  'a user outside the room should not record progress'
);

reset role;

select * from finish();

rollback;
