begin;

\ir ../helpers/auth.inc

select plan(25);

select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000191',
  'post-rpc-owner@test.local',
  'RPC 방장'
);
select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000192',
  'post-rpc-replier@test.local',
  'RPC 답글러'
);
select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000193',
  'post-rpc-mentioned@test.local',
  'RPC 멘션'
);
select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000194',
  'post-rpc-outsider@test.local',
  'RPC 외부'
);

insert into public.reading_rooms (id, name, created_by)
values (
  '10000000-0000-0000-0000-000000000091',
  '게시글 RPC 테스트 방',
  '00000000-0000-0000-0000-000000000191'
);

insert into public.room_members (
  id,
  room_id,
  profile_id,
  role,
  room_display_name,
  room_avatar_path
)
values
  (
    '20000000-0000-0000-0000-000000000091',
    '10000000-0000-0000-0000-000000000091',
    '00000000-0000-0000-0000-000000000191',
    'owner',
    'RPC 방장',
    'room-avatars/owner.png'
  ),
  (
    '20000000-0000-0000-0000-000000000092',
    '10000000-0000-0000-0000-000000000091',
    '00000000-0000-0000-0000-000000000192',
    'member',
    'RPC 답글러',
    null
  ),
  (
    '20000000-0000-0000-0000-000000000093',
    '10000000-0000-0000-0000-000000000091',
    '00000000-0000-0000-0000-000000000193',
    'member',
    'RPC 멘션',
    null
  );

insert into public.books (id, source, title)
values ('40000000-0000-0000-0000-000000000091', 'manual', '게시글 RPC 테스트 책');

insert into public.book_chats (id, room_id, book_id, created_by_member_id, name)
values (
  '50000000-0000-0000-0000-000000000091',
  '10000000-0000-0000-0000-000000000091',
  '40000000-0000-0000-0000-000000000091',
  '20000000-0000-0000-0000-000000000091',
  '게시글 RPC 테스트 채팅'
);

select tests.authenticate_as('00000000-0000-0000-0000-000000000191');
set local role authenticated;

create temporary table root_result as
select public.create_post(
  '50000000-0000-0000-0000-000000000091',
  '70000000-0000-0000-0000-000000000091',
  'text',
  '  첫 번째 원문  ',
  '[{"kind":"page","value":"87페이지"},{"kind":"custom","value":"핵심"}]'::jsonb,
  array[
    '20000000-0000-0000-0000-000000000092'::uuid,
    '20000000-0000-0000-0000-000000000092'::uuid
  ]
) as id;

select isnt((select id from root_result), null::uuid, 'create_post should return a post id');
select is(
  (select count(*) from public.post_labels where post_id = (select id from root_result)),
  2::bigint,
  'create_post should attach ordered labels'
);
select is(
  (select count(*) from public.post_mentions where post_id = (select id from root_result)),
  1::bigint,
  'create_post should deduplicate mentioned members'
);
select is(
  (
    select author_name_snapshot || ':' || author_avatar_snapshot
    from public.posts
    where id = (select id from root_result)
  ),
  'RPC 방장:room-avatars/owner.png',
  'create_post should capture the room identity snapshot'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000192');
set local role authenticated;

select is(
  (select count(*) from public.notifications where type = 'mention'),
  1::bigint,
  'a mentioned member should receive one notification'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000191');
set local role authenticated;

select is(
  public.create_post(
    '50000000-0000-0000-0000-000000000091',
    '70000000-0000-0000-0000-000000000091',
    'text',
    '재시도 본문',
    '[]'::jsonb,
    '{}'
  ),
  (select id from root_result),
  'the same client id should return the existing post'
);
select is((select count(*) from public.posts), 1::bigint, 'an idempotent retry should not add a post');
select is((select count(*) from public.post_labels), 2::bigint, 'an idempotent retry should not add labels');
select is((select count(*) from public.post_mentions), 1::bigint, 'an idempotent retry should not add mentions');

select throws_ok(
  $$
    select public.create_post(
      '50000000-0000-0000-0000-000000000091',
      '70000000-0000-0000-0000-000000000092',
      'text',
      null,
      '[]'::jsonb,
      '{}'
    )
  $$,
  'P0001',
  'VALIDATION_FAILED',
  'a text post should require a body or label'
);
select throws_ok(
  $$
    select public.create_post(
      '50000000-0000-0000-0000-000000000091',
      '70000000-0000-0000-0000-000000000093',
      'text',
      '잘못된 라벨',
      '[{"kind":"bad","value":"라벨"}]'::jsonb,
      '{}'
    )
  $$,
  'P0001',
  'VALIDATION_FAILED',
  'an invalid label should fail the whole RPC'
);
select throws_ok(
  $$
    select public.create_post(
      '50000000-0000-0000-0000-000000000091',
      '70000000-0000-0000-0000-000000000094',
      'text',
      '잘못된 멘션',
      '[]'::jsonb,
      array['20000000-0000-0000-0000-000000000099'::uuid]
    )
  $$,
  'P0001',
  'MENTION_MEMBER_INVALID',
  'an invalid mention should fail the whole RPC'
);
select throws_ok(
  $$
    select public.create_post(
      '50000000-0000-0000-0000-000000000091',
      '70000000-0000-0000-0000-000000000099',
      'text',
      '멘션 상한 초과',
      '[]'::jsonb,
      array[
        '20000000-0000-0000-0000-000000000101'::uuid,
        '20000000-0000-0000-0000-000000000102'::uuid,
        '20000000-0000-0000-0000-000000000103'::uuid,
        '20000000-0000-0000-0000-000000000104'::uuid,
        '20000000-0000-0000-0000-000000000105'::uuid,
        '20000000-0000-0000-0000-000000000106'::uuid,
        '20000000-0000-0000-0000-000000000107'::uuid
      ]
    )
  $$,
  'P0001',
  'MENTION_LIMIT_EXCEEDED',
  'create_post should reject seven distinct mention member ids before membership validation'
);
select is(
  (select count(*) from public.posts),
  1::bigint,
  'failed metadata attachment should roll back the post'
);

create temporary table label_only_result as
select public.create_post(
  '50000000-0000-0000-0000-000000000091',
  '70000000-0000-0000-0000-000000000095',
  'text',
  null,
  '[{"kind":"chapter","value":"3장"}]'::jsonb,
  '{}'
) as id;

select isnt(
  (select id from label_only_result),
  null::uuid,
  'a label-only text post should be accepted'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000192');
set local role authenticated;

create temporary table reply_result as
select public.create_reply(
  (select id from root_result),
  '70000000-0000-0000-0000-000000000096',
  '  원문에 대한 답글  ',
  array[
    '20000000-0000-0000-0000-000000000091'::uuid,
    '20000000-0000-0000-0000-000000000093'::uuid
  ]
) as id;

select is(
  (
    select depth = 1 and parent_post_id = root_post_id and root_post_id = (select id from root_result)
    from public.posts
    where id = (select id from reply_result)
  ),
  true,
  'create_reply should create a Phase 1 root reply'
);
select is(
  (select count(*) from public.post_mentions where post_id = (select id from reply_result)),
  2::bigint,
  'create_reply should preserve valid mention links'
);
select throws_ok(
  format(
    'select public.create_reply(%L::uuid, %L::uuid, %L, %L::uuid[])',
    (select id from root_result),
    '70000000-0000-0000-0000-000000000100',
    '답글 멘션 상한 초과',
    array[
      '20000000-0000-0000-0000-000000000101'::uuid,
      '20000000-0000-0000-0000-000000000102'::uuid,
      '20000000-0000-0000-0000-000000000103'::uuid,
      '20000000-0000-0000-0000-000000000104'::uuid,
      '20000000-0000-0000-0000-000000000105'::uuid,
      '20000000-0000-0000-0000-000000000106'::uuid,
      '20000000-0000-0000-0000-000000000107'::uuid
    ]
  ),
  'P0001',
  'MENTION_LIMIT_EXCEEDED',
  'create_reply should reject seven distinct mention member ids before membership validation'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000191');
set local role authenticated;

select is(
  (select count(*) from public.notifications where type = 'reply' and post_id = (select id from reply_result)),
  1::bigint,
  'the root author should receive one reply notification'
);
select is(
  (select count(*) from public.notifications where type = 'mention' and post_id = (select id from reply_result)),
  0::bigint,
  'the root author should not receive a duplicate mention notification'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000193');
set local role authenticated;

select is(
  (select count(*) from public.notifications where type = 'mention' and post_id = (select id from reply_result)),
  1::bigint,
  'another mentioned member should receive a mention notification'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000192');
set local role authenticated;

select is(
  public.create_reply(
    (select id from root_result),
    '70000000-0000-0000-0000-000000000096',
    '재시도 답글',
    '{}'
  ),
  (select id from reply_result),
  'the same reply client id should return the existing reply'
);
select is((select count(*) from public.posts), 3::bigint, 'the room should contain two roots and one reply');

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000194');
set local role authenticated;

select throws_ok(
  format(
    'select public.create_reply(%L::uuid, %L::uuid, %L, %L::uuid[])',
    (select id from root_result),
    '70000000-0000-0000-0000-000000000097',
    '외부 답글',
    '{}'
  ),
  'P0001',
  'ROOM_FORBIDDEN',
  'a non-member should not reply in another room'
);

reset role;
update public.book_chats
set status = 'archived', archived_at = now()
where id = '50000000-0000-0000-0000-000000000091';

select tests.authenticate_as('00000000-0000-0000-0000-000000000192');
set local role authenticated;

select throws_ok(
  $$
    select public.create_post(
      '50000000-0000-0000-0000-000000000091',
      '70000000-0000-0000-0000-000000000098',
      'text',
      '보관 채팅 쓰기',
      '[]'::jsonb,
      '{}'
    )
  $$,
  'P0001',
  'BOOK_CHAT_ARCHIVED',
  'an archived book chat should reject new posts'
);

reset role;

select * from finish();

rollback;
