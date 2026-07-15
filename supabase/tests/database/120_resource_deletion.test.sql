begin;

\ir ../helpers/auth.inc

select plan(22);

select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000221',
  'resource-owner@test.local',
  '삭제 방장'
);
select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000222',
  'resource-creator@test.local',
  '채팅 생성자'
);
select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000223',
  'resource-member@test.local',
  '일반 멤버'
);

insert into public.reading_rooms (id, name, created_by)
values (
  '10000000-0000-0000-0000-000000000121',
  '삭제 복구 테스트 방',
  '00000000-0000-0000-0000-000000000221'
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
    '20000000-0000-0000-0000-000000000121',
    '10000000-0000-0000-0000-000000000121',
    '00000000-0000-0000-0000-000000000221',
    'owner',
    '삭제 방장'
  ),
  (
    '20000000-0000-0000-0000-000000000122',
    '10000000-0000-0000-0000-000000000121',
    '00000000-0000-0000-0000-000000000222',
    'member',
    '채팅 생성자'
  ),
  (
    '20000000-0000-0000-0000-000000000123',
    '10000000-0000-0000-0000-000000000121',
    '00000000-0000-0000-0000-000000000223',
    'member',
    '일반 멤버'
  );

insert into public.books (id, source, title)
values ('40000000-0000-0000-0000-000000000121', 'manual', '삭제 복구 테스트 책');

insert into public.book_chats (id, room_id, book_id, created_by_member_id, name)
values (
  '50000000-0000-0000-0000-000000000121',
  '10000000-0000-0000-0000-000000000121',
  '40000000-0000-0000-0000-000000000121',
  '20000000-0000-0000-0000-000000000122',
  '삭제 복구 테스트 채팅'
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
values (
  '60000000-0000-0000-0000-000000000121',
  '50000000-0000-0000-0000-000000000121',
  '20000000-0000-0000-0000-000000000122',
  'video',
  '삭제 복구 영상',
  '70000000-0000-0000-0000-000000000121',
  '채팅 생성자'
);

insert into public.video_assets (
  post_id,
  mux_upload_id,
  mux_asset_id,
  playback_id,
  status,
  duration_seconds,
  ready_at
)
values (
  '60000000-0000-0000-0000-000000000121',
  'resource-upload-121',
  'resource-asset-121',
  'resource-playback-121',
  'ready',
  15,
  now()
);

select tests.authenticate_as('00000000-0000-0000-0000-000000000221');
set local role authenticated;

select throws_ok(
  $$
    select public.delete_reading_room(
      '10000000-0000-0000-0000-000000000121',
      '틀린 방 이름'
    )
  $$,
  'P0001',
  'VALIDATION_FAILED',
  'room deletion should require the exact room name'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000222');
set local role authenticated;

select throws_ok(
  $$
    select public.delete_reading_room(
      '10000000-0000-0000-0000-000000000121',
      '삭제 복구 테스트 방'
    )
  $$,
  'P0001',
  'ROOM_FORBIDDEN',
  'a non-owner should not delete the reading room'
);
select throws_ok(
  $$
    select public.delete_book_chat(
      '50000000-0000-0000-0000-000000000121',
      '틀린 채팅 이름'
    )
  $$,
  'P0001',
  'VALIDATION_FAILED',
  'chat deletion should require the exact chat name'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000223');
set local role authenticated;

select throws_ok(
  $$
    select public.delete_book_chat(
      '50000000-0000-0000-0000-000000000121',
      '삭제 복구 테스트 채팅'
    )
  $$,
  'P0001',
  'ROOM_FORBIDDEN',
  'a member who is not owner or creator should not delete the chat'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000222');
set local role authenticated;

select is(
  public.delete_book_chat(
    '50000000-0000-0000-0000-000000000121',
    '삭제 복구 테스트 채팅'
  ),
  1,
  'the chat creator should enqueue one video deletion job'
);

reset role;

select is(
  (select status from public.book_chats where id = '50000000-0000-0000-0000-000000000121'),
  'deleted'::public.book_chat_status,
  'chat deletion should soft-delete the chat immediately'
);

select tests.authenticate_as('00000000-0000-0000-0000-000000000223');
set local role authenticated;

select is((select count(*) from public.book_chats), 0::bigint, 'RLS should hide a deleted chat immediately');

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000222');
set local role authenticated;

select lives_ok(
  $$select public.restore_book_chat('50000000-0000-0000-0000-000000000121')$$,
  'the creator should restore a chat before deletion work starts'
);

reset role;

select is(
  (select status from public.book_chats where id = '50000000-0000-0000-0000-000000000121'),
  'archived'::public.book_chat_status,
  'a restored chat should return as archived for explicit reopening'
);
select is(
  (select count(*) from public.deletion_jobs where target_id = '60000000-0000-0000-0000-000000000121'),
  0::bigint,
  'restoring should cancel unstarted chat deletion jobs'
);

select tests.authenticate_as('00000000-0000-0000-0000-000000000222');
set local role authenticated;

select is(
  public.delete_book_chat(
    '50000000-0000-0000-0000-000000000121',
    '삭제 복구 테스트 채팅'
  ),
  1,
  'deleting the restored chat should enqueue work again'
);

reset role;
create temporary table claimed_chat_job as
select * from public.claim_deletion_jobs(1);

select is(
  (select attempts from claimed_chat_job),
  1::smallint,
  'the worker should start the chat video deletion job'
);

select tests.authenticate_as('00000000-0000-0000-0000-000000000222');
set local role authenticated;

select throws_ok(
  $$select public.restore_book_chat('50000000-0000-0000-0000-000000000121')$$,
  'P0001',
  'CONFLICT',
  'a chat should not restore after external deletion starts'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000221');
set local role authenticated;

select isnt(
  public.delete_reading_room(
    '10000000-0000-0000-0000-000000000121',
    '삭제 복구 테스트 방'
  ),
  null::uuid,
  'the owner should enqueue room deletion work'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000223');
set local role authenticated;

select is((select count(*) from public.reading_rooms), 0::bigint, 'RLS should hide a deleted room immediately');
select is((select count(*) from public.book_chats), 0::bigint, 'deleting a room should hide all child chats');

reset role;

select is(
  (
    select status
    from public.deletion_jobs
    where scope = 'room' and target_id = '10000000-0000-0000-0000-000000000121'
  ),
  'queued'::public.job_status,
  'room deletion should create a queued room job'
);

select tests.authenticate_as('00000000-0000-0000-0000-000000000221');
set local role authenticated;

select lives_ok(
  $$select public.restore_reading_room('10000000-0000-0000-0000-000000000121')$$,
  'the owner should restore a room before its room job starts'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000223');
set local role authenticated;

select is((select count(*) from public.reading_rooms), 1::bigint, 'restoring should make the room visible again');

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000221');
set local role authenticated;

select isnt(
  public.delete_reading_room(
    '10000000-0000-0000-0000-000000000121',
    '삭제 복구 테스트 방'
  ),
  null::uuid,
  'deleting the restored room should enqueue a new room job'
);

reset role;
create temporary table claimed_room_job as
select * from public.claim_deletion_jobs(10)
where scope = 'room';

select is(
  (select attempts from claimed_room_job),
  1::smallint,
  'the worker should start the room deletion job'
);

select tests.authenticate_as('00000000-0000-0000-0000-000000000221');
set local role authenticated;

select throws_ok(
  $$select public.restore_reading_room('10000000-0000-0000-0000-000000000121')$$,
  'P0001',
  'CONFLICT',
  'a room should not restore after external deletion starts'
);

reset role;

select * from finish();

rollback;
