begin;

\ir ../helpers/auth.inc

select plan(21);

select has_table('public', 'posts', 'posts table should exist');
select has_table('public', 'post_labels', 'post_labels table should exist');
select has_table('public', 'post_mentions', 'post_mentions table should exist');
select ok(
  (
    select indisunique
    from pg_index
    where indexrelid = 'public.posts_author_client_unique'::regclass
  ),
  'author and client id should have a unique partial index'
);

select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000171',
  'post-author@test.local',
  '글 작성자'
);
select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000172',
  'post-mentioned@test.local',
  '멘션 멤버'
);
select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000173',
  'post-other-room@test.local',
  '다른 방 멤버'
);

insert into public.reading_rooms (id, name, created_by)
values
  (
    '10000000-0000-0000-0000-000000000071',
    '메시지 테스트 방',
    '00000000-0000-0000-0000-000000000171'
  ),
  (
    '10000000-0000-0000-0000-000000000072',
    '다른 메시지 방',
    '00000000-0000-0000-0000-000000000173'
  );

insert into public.room_members (
  id,
  room_id,
  profile_id,
  role,
  room_display_name
)
values
  (
    '20000000-0000-0000-0000-000000000071',
    '10000000-0000-0000-0000-000000000071',
    '00000000-0000-0000-0000-000000000171',
    'owner',
    '글 작성자'
  ),
  (
    '20000000-0000-0000-0000-000000000072',
    '10000000-0000-0000-0000-000000000071',
    '00000000-0000-0000-0000-000000000172',
    'member',
    '멘션 멤버'
  ),
  (
    '20000000-0000-0000-0000-000000000073',
    '10000000-0000-0000-0000-000000000072',
    '00000000-0000-0000-0000-000000000173',
    'owner',
    '다른 방 멤버'
  );

insert into public.books (id, source, title)
values
  ('40000000-0000-0000-0000-000000000071', 'manual', '메시지 테스트 책'),
  ('40000000-0000-0000-0000-000000000072', 'manual', '다른 메시지 책');

insert into public.book_chats (id, room_id, book_id, created_by_member_id, name)
values
  (
    '50000000-0000-0000-0000-000000000071',
    '10000000-0000-0000-0000-000000000071',
    '40000000-0000-0000-0000-000000000071',
    '20000000-0000-0000-0000-000000000071',
    '메시지 테스트 채팅'
  ),
  (
    '50000000-0000-0000-0000-000000000072',
    '10000000-0000-0000-0000-000000000072',
    '40000000-0000-0000-0000-000000000072',
    '20000000-0000-0000-0000-000000000073',
    '다른 메시지 채팅'
  );

insert into public.posts (
  id,
  book_chat_id,
  author_member_id,
  type,
  body,
  client_id,
  author_name_snapshot
)
values
  (
    '60000000-0000-0000-0000-000000000071',
    '50000000-0000-0000-0000-000000000071',
    '20000000-0000-0000-0000-000000000071',
    'text',
    '첫 번째 독후감',
    '70000000-0000-0000-0000-000000000071',
    '글 작성자'
  ),
  (
    '60000000-0000-0000-0000-000000000072',
    '50000000-0000-0000-0000-000000000072',
    '20000000-0000-0000-0000-000000000073',
    'text',
    '다른 방 독후감',
    '70000000-0000-0000-0000-000000000072',
    '다른 방 멤버'
  );

insert into public.post_labels (post_id, kind, value)
values ('60000000-0000-0000-0000-000000000071', 'page', '87페이지');

insert into public.post_mentions (post_id, mentioned_member_id)
values (
  '60000000-0000-0000-0000-000000000071',
  '20000000-0000-0000-0000-000000000072'
);

select throws_ok(
  $$
    insert into public.posts (
      book_chat_id, author_member_id, type, body, client_id, author_name_snapshot
    )
    values (
      '50000000-0000-0000-0000-000000000071',
      '20000000-0000-0000-0000-000000000071',
      'text',
      '중복 요청',
      '70000000-0000-0000-0000-000000000071',
      '글 작성자'
    )
  $$,
  '23505',
  null,
  'the same author client id should be idempotent at the database boundary'
);

select lives_ok(
  $$
    insert into public.posts (
      id, book_chat_id, author_member_id, type, body,
      parent_post_id, root_post_id, depth, client_id, author_name_snapshot
    )
    values (
      '60000000-0000-0000-0000-000000000073',
      '50000000-0000-0000-0000-000000000071',
      '20000000-0000-0000-0000-000000000072',
      'text',
      '원문에 대한 답글',
      '60000000-0000-0000-0000-000000000071',
      '60000000-0000-0000-0000-000000000071',
      1,
      '70000000-0000-0000-0000-000000000073',
      '멘션 멤버'
    )
  $$,
  'a same-chat depth-one text reply should be accepted'
);

select throws_ok(
  $$
    insert into public.posts (
      book_chat_id, author_member_id, type, body,
      parent_post_id, root_post_id, depth, client_id, author_name_snapshot
    )
    values (
      '50000000-0000-0000-0000-000000000071',
      '20000000-0000-0000-0000-000000000071',
      'text',
      '깊이 2 답글',
      '60000000-0000-0000-0000-000000000073',
      '60000000-0000-0000-0000-000000000071',
      2,
      '70000000-0000-0000-0000-000000000074',
      '글 작성자'
    )
  $$,
  '23514',
  null,
  'Phase 1 should reject replies deeper than one'
);

select throws_ok(
  $$
    insert into public.posts (
      book_chat_id, author_member_id, type,
      parent_post_id, root_post_id, depth, client_id, author_name_snapshot
    )
    values (
      '50000000-0000-0000-0000-000000000071',
      '20000000-0000-0000-0000-000000000071',
      'video',
      '60000000-0000-0000-0000-000000000071',
      '60000000-0000-0000-0000-000000000071',
      1,
      '70000000-0000-0000-0000-000000000075',
      '글 작성자'
    )
  $$,
  '23514',
  null,
  'Phase 1 should reject video replies'
);

select throws_ok(
  $$
    insert into public.posts (
      book_chat_id, author_member_id, type, body,
      parent_post_id, root_post_id, depth, client_id, author_name_snapshot
    )
    values (
      '50000000-0000-0000-0000-000000000072',
      '20000000-0000-0000-0000-000000000073',
      'text',
      '다른 채팅 원문 답글',
      '60000000-0000-0000-0000-000000000071',
      '60000000-0000-0000-0000-000000000071',
      1,
      '70000000-0000-0000-0000-000000000076',
      '다른 방 멤버'
    )
  $$,
  'P0001',
  'POST_CROSS_THREAD_REPLY',
  'a reply should not cross book chats'
);

select throws_ok(
  $$
    insert into public.posts (
      book_chat_id, author_member_id, type, body, client_id, author_name_snapshot
    )
    values (
      '50000000-0000-0000-0000-000000000071',
      '20000000-0000-0000-0000-000000000073',
      'text',
      '다른 방 작성자',
      '70000000-0000-0000-0000-000000000077',
      '다른 방 멤버'
    )
  $$,
  'P0001',
  'ROOM_FORBIDDEN',
  'an author membership should belong to the post room'
);

select throws_ok(
  $$
    insert into public.post_mentions (post_id, mentioned_member_id)
    values (
      '60000000-0000-0000-0000-000000000071',
      '20000000-0000-0000-0000-000000000073'
    )
  $$,
  'P0001',
  'MENTION_MEMBER_INVALID',
  'a mention should reject members outside the post room'
);

select tests.authenticate_as('00000000-0000-0000-0000-000000000171');
set local role authenticated;

select is((select count(*) from public.posts), 2::bigint, 'a member should select posts in their room');
select is((select count(*) from public.post_labels), 1::bigint, 'a member should select labels in their room');
select is((select count(*) from public.post_mentions), 1::bigint, 'a member should select mentions in their room');
select is(
  private.can_access_post('60000000-0000-0000-0000-000000000071'),
  true,
  'a member should resolve post access in their room'
);
select throws_ok(
  $$
    insert into public.posts (
      book_chat_id, author_member_id, type, body, client_id, author_name_snapshot
    )
    values (
      '50000000-0000-0000-0000-000000000071',
      '20000000-0000-0000-0000-000000000071',
      'text',
      '직접 쓰기 시도',
      '70000000-0000-0000-0000-000000000078',
      '글 작성자'
    )
  $$,
  '42501',
  null,
  'an authenticated member should create posts only through the RPC'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000173');
set local role authenticated;

select is((select count(*) from public.posts), 1::bigint, 'another room member should only select their room post');
select is((select count(*) from public.post_labels), 0::bigint, 'another room member should not select labels');
select is((select count(*) from public.post_mentions), 0::bigint, 'another room member should not select mentions');
select is(
  private.can_access_post('60000000-0000-0000-0000-000000000071'),
  false,
  'another room member should not resolve post access'
);

reset role;
set local role anon;

select throws_ok(
  $$select * from public.posts$$,
  '42501',
  null,
  'anon should not select posts'
);

reset role;

select * from finish();

rollback;
