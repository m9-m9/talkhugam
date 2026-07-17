begin;

\ir ../helpers/auth.inc

select plan(14);

select has_table(
  'public',
  'book_chat_completions',
  'book chat completions table should exist'
);
select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.book_chat_completions'::regclass
  ),
  'book chat completions should enable RLS'
);
select has_index(
  'public',
  'book_chat_completions',
  'book_chat_completions_profile_completed_at_idx',
  'my completed books should have an ordered profile index'
);
select has_function(
  'public',
  'upsert_book_chat_completion',
  array['uuid', 'smallint', 'text'],
  'completion upsert function should exist'
);
select has_function(
  'public',
  'remove_book_chat_completion',
  array['uuid'],
  'completion removal function should exist'
);

select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000181',
  'completion-owner@test.local',
  '완독 방장'
);
select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000182',
  'completion-member@test.local',
  '완독 멤버'
);
select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000183',
  'completion-stranger@test.local',
  '완독 외부 사용자'
);

insert into public.reading_rooms (id, name, created_by)
values (
  '10000000-0000-0000-0000-000000000181',
  '완독 테스트 모임',
  '00000000-0000-0000-0000-000000000181'
);

insert into public.room_members (id, room_id, profile_id, role, room_display_name)
values
  (
    '20000000-0000-0000-0000-000000000181',
    '10000000-0000-0000-0000-000000000181',
    '00000000-0000-0000-0000-000000000181',
    'owner',
    '완독 방장'
  ),
  (
    '20000000-0000-0000-0000-000000000182',
    '10000000-0000-0000-0000-000000000181',
    '00000000-0000-0000-0000-000000000182',
    'member',
    '완독 멤버'
  );

insert into public.books (id, source, title, authors)
values (
  '30000000-0000-0000-0000-000000000181',
  'manual',
  '완독 테스트 책',
  array['테스트 작가']
);

insert into public.book_chats (id, room_id, book_id, name)
values (
  '40000000-0000-0000-0000-000000000181',
  '10000000-0000-0000-0000-000000000181',
  '30000000-0000-0000-0000-000000000181',
  '완독 테스트 책 대화'
);

select tests.authenticate_as('00000000-0000-0000-0000-000000000181');
set local role authenticated;

select lives_ok(
  $$
    select public.upsert_book_chat_completion(
      '40000000-0000-0000-0000-000000000181',
      5::smallint,
      '오래 남는 책이었어요.'
    )
  $$,
  'an active member should record a personal completion'
);
select is(
  (
    select rating
    from public.book_chat_completions
    where book_chat_id = '40000000-0000-0000-0000-000000000181'
      and profile_id = '00000000-0000-0000-0000-000000000181'
  ),
  5::smallint,
  'a completion should persist its rating'
);
select is(
  (
    select review
    from public.book_chat_completions
    where book_chat_id = '40000000-0000-0000-0000-000000000181'
      and profile_id = '00000000-0000-0000-0000-000000000181'
  ),
  '오래 남는 책이었어요.',
  'a completion should persist its review'
);
select throws_ok(
  $$
    select public.upsert_book_chat_completion(
      '40000000-0000-0000-0000-000000000181',
      6::smallint,
      null
    )
  $$,
  'P0001',
  'VALIDATION_FAILED',
  'a rating outside one through five should be rejected'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000182');
set local role authenticated;

select is(
  (
    select count(*)
    from public.book_chat_completions
    where book_chat_id = '40000000-0000-0000-0000-000000000181'
  ),
  1::bigint,
  'another active room member should see the completion roster'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000183');
set local role authenticated;

select is(
  (select count(*) from public.book_chat_completions),
  0::bigint,
  'a user outside the room should not see completions'
);
select throws_ok(
  $$
    select public.upsert_book_chat_completion(
      '40000000-0000-0000-0000-000000000181',
      null,
      null
    )
  $$,
  'P0001',
  'ROOM_FORBIDDEN',
  'a user outside the room should not record a completion'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000181');
set local role authenticated;

select lives_ok(
  $$
    select public.remove_book_chat_completion(
      '40000000-0000-0000-0000-000000000181'
    )
  $$,
  'an active member should remove their personal completion'
);
select is(
  (select count(*) from public.book_chat_completions),
  0::bigint,
  'removing a completion should remove it from the roster'
);

reset role;

select * from finish();

rollback;
