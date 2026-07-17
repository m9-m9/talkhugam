begin;

\ir ../helpers/auth.inc

select plan(5);

select has_function(
  'public',
  'get_my_reading_room_summaries',
  array[]::text[],
  'reading-room summaries function should exist'
);

select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000171',
  'summary-owner@test.local',
  '목록 사용자'
);
select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000172',
  'summary-friend@test.local',
  '최근 메시지 친구'
);
select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000173',
  'summary-stranger@test.local',
  '목록 외부 사용자'
);

insert into public.reading_rooms (id, name, created_by)
values
  (
    '10000000-0000-0000-0000-000000000171',
    '먼저 이야기한 모임',
    '00000000-0000-0000-0000-000000000171'
  ),
  (
    '10000000-0000-0000-0000-000000000172',
    '최근 이야기한 모임',
    '00000000-0000-0000-0000-000000000171'
  );

insert into public.room_members (id, room_id, profile_id, role, room_display_name)
values
  (
    '20000000-0000-0000-0000-000000000171',
    '10000000-0000-0000-0000-000000000171',
    '00000000-0000-0000-0000-000000000171',
    'owner',
    '목록 사용자'
  ),
  (
    '20000000-0000-0000-0000-000000000172',
    '10000000-0000-0000-0000-000000000172',
    '00000000-0000-0000-0000-000000000171',
    'owner',
    '목록 사용자'
  ),
  (
    '20000000-0000-0000-0000-000000000173',
    '10000000-0000-0000-0000-000000000172',
    '00000000-0000-0000-0000-000000000172',
    'member',
    '최근 메시지 친구'
  );

insert into public.books (id, source, title)
values
  ('30000000-0000-0000-0000-000000000171', 'manual', '첫 번째 책'),
  ('30000000-0000-0000-0000-000000000172', 'manual', '두 번째 책');

insert into public.book_chats (id, room_id, book_id, name)
values
  (
    '40000000-0000-0000-0000-000000000171',
    '10000000-0000-0000-0000-000000000171',
    '30000000-0000-0000-0000-000000000171',
    '첫 번째 책 대화'
  ),
  (
    '40000000-0000-0000-0000-000000000172',
    '10000000-0000-0000-0000-000000000172',
    '30000000-0000-0000-0000-000000000172',
    '두 번째 책 대화'
  );

insert into public.posts (
  id,
  book_chat_id,
  author_member_id,
  type,
  body,
  client_id,
  author_name_snapshot,
  created_at
)
values
  (
    '50000000-0000-0000-0000-000000000171',
    '40000000-0000-0000-0000-000000000171',
    '20000000-0000-0000-0000-000000000171',
    'text',
    '먼저 남긴 감상',
    '60000000-0000-0000-0000-000000000171',
    '목록 사용자',
    '2026-07-17 09:00:00+00'
  ),
  (
    '50000000-0000-0000-0000-000000000172',
    '40000000-0000-0000-0000-000000000172',
    '20000000-0000-0000-0000-000000000173',
    'text',
    '가장 최근에 받은 감상',
    '60000000-0000-0000-0000-000000000172',
    '최근 메시지 친구',
    '2026-07-17 10:00:00+00'
  );

select tests.authenticate_as('00000000-0000-0000-0000-000000000171');
set local role authenticated;

select is(
  (select name from public.get_my_reading_room_summaries() limit 1),
  '최근 이야기한 모임',
  'the most recently received message should sort its room first'
);
select is(
  (select last_message_author_name from public.get_my_reading_room_summaries() limit 1),
  '최근 메시지 친구',
  'a received message should be exposed as the latest room activity'
);
select is(
  (select last_message_body from public.get_my_reading_room_summaries() limit 1),
  '가장 최근에 받은 감상',
  'the room summary should include the latest message preview'
);

reset role;

select tests.authenticate_as('00000000-0000-0000-0000-000000000173');
set local role authenticated;

select is(
  (select count(*) from public.get_my_reading_room_summaries()),
  0::bigint,
  'a user outside every room should receive no room summaries'
);

reset role;

select * from finish();

rollback;
