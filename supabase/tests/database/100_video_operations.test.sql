begin;

\ir ../helpers/auth.inc

select plan(28);

select has_table('public', 'video_assets', 'video_assets table should exist');
select has_table('public', 'mux_events', 'mux_events table should exist');
select has_table('public', 'deletion_jobs', 'deletion_jobs table should exist');

select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000201',
  'video-member@test.local',
  '영상 멤버'
);
select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000202',
  'video-outsider@test.local',
  '영상 외부'
);

insert into public.reading_rooms (id, name, created_by)
values (
  '10000000-0000-0000-0000-000000000101',
  '영상 테스트 방',
  '00000000-0000-0000-0000-000000000201'
);

insert into public.room_members (
  id,
  room_id,
  profile_id,
  role,
  room_display_name
)
values (
  '20000000-0000-0000-0000-000000000101',
  '10000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000201',
  'owner',
  '영상 멤버'
);

insert into public.books (id, source, title)
values ('40000000-0000-0000-0000-000000000101', 'manual', '영상 테스트 책');

insert into public.book_chats (id, room_id, book_id, created_by_member_id, name)
values (
  '50000000-0000-0000-0000-000000000101',
  '10000000-0000-0000-0000-000000000101',
  '40000000-0000-0000-0000-000000000101',
  '20000000-0000-0000-0000-000000000101',
  '영상 테스트 채팅'
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
    '60000000-0000-0000-0000-000000000101',
    '50000000-0000-0000-0000-000000000101',
    '20000000-0000-0000-0000-000000000101',
    'video',
    '첫 번째 영상',
    '70000000-0000-0000-0000-000000000101',
    '영상 멤버'
  ),
  (
    '60000000-0000-0000-0000-000000000102',
    '50000000-0000-0000-0000-000000000101',
    '20000000-0000-0000-0000-000000000101',
    'video',
    '길이 초과 영상',
    '70000000-0000-0000-0000-000000000102',
    '영상 멤버'
  ),
  (
    '60000000-0000-0000-0000-000000000103',
    '50000000-0000-0000-0000-000000000101',
    '20000000-0000-0000-0000-000000000101',
    'text',
    '텍스트 원문',
    '70000000-0000-0000-0000-000000000103',
    '영상 멤버'
  );

insert into public.video_assets (post_id, mux_upload_id)
values
  ('60000000-0000-0000-0000-000000000101', 'upload-video-101'),
  ('60000000-0000-0000-0000-000000000102', 'upload-video-102');

select throws_ok(
  $$
    insert into public.video_assets (post_id, mux_upload_id)
    values ('60000000-0000-0000-0000-000000000103', 'upload-text-103')
  $$,
  'P0001',
  'POST_NOT_FOUND',
  'a text post should not accept a video asset'
);

select is(
  public.apply_mux_video_event(
    'event-processing-101',
    'video.upload.asset_created',
    '60000000-0000-0000-0000-000000000101',
    'processing',
    'asset-101',
    'asset-101'
  ),
  true,
  'a new processing event should be applied'
);
select is(
  (select status from public.video_assets where post_id = '60000000-0000-0000-0000-000000000101'),
  'processing'::public.video_status,
  'asset_created should move waiting_upload to processing'
);
select is(
  public.apply_mux_video_event(
    'event-ready-101',
    'video.asset.ready',
    '60000000-0000-0000-0000-000000000101',
    'ready',
    'asset-101',
    'asset-101',
    'playback-101',
    29.500,
    '9:16'
  ),
  true,
  'a new ready event should be applied'
);
select is(
  (select status from public.video_assets where post_id = '60000000-0000-0000-0000-000000000101'),
  'ready'::public.video_status,
  'a valid 30 second or shorter asset should become ready'
);
select is(
  public.apply_mux_video_event(
    'event-ready-101',
    'video.asset.ready',
    '60000000-0000-0000-0000-000000000101',
    'ready',
    'asset-101',
    'asset-101',
    'playback-duplicate',
    10,
    '1:1'
  ),
  false,
  'a duplicate Mux event id should be ignored'
);
select is(
  (select duration_seconds from public.video_assets where post_id = '60000000-0000-0000-0000-000000000101'),
  29.500::numeric,
  'a duplicate event should not overwrite ready metadata'
);
select is(
  public.apply_mux_video_event(
    'event-late-processing-101',
    'video.upload.asset_created',
    '60000000-0000-0000-0000-000000000101',
    'processing',
    'asset-101',
    'asset-101'
  ),
  true,
  'a unique out-of-order event should be recorded'
);
select is(
  (select status from public.video_assets where post_id = '60000000-0000-0000-0000-000000000101'),
  'ready'::public.video_status,
  'an out-of-order processing event should not regress ready state'
);
select is(
  public.apply_mux_video_event(
    'event-too-long-102',
    'video.asset.ready',
    '60000000-0000-0000-0000-000000000102',
    'ready',
    'asset-102',
    'asset-102',
    'playback-102',
    30.001,
    '16:9'
  ),
  true,
  'an over-limit ready event should be consumed'
);
select is(
  (
    select status::text || ':' || error_code
    from public.video_assets
    where post_id = '60000000-0000-0000-0000-000000000102'
  ),
  'failed:VIDEO_TOO_LONG',
  'an over-limit asset should fail without becoming playable'
);
select is(
  (select count(*) from public.deletion_jobs where target_id = '60000000-0000-0000-0000-000000000102'),
  1::bigint,
  'an over-limit asset should enqueue one deletion job'
);
select is(
  public.apply_mux_video_event(
    'event-too-long-102',
    'video.asset.ready',
    '60000000-0000-0000-0000-000000000102',
    'ready',
    'asset-102',
    'asset-102',
    'playback-102',
    30.001,
    '16:9'
  ),
  false,
  'a duplicate over-limit event should be ignored'
);
select is(
  (select count(*) from public.deletion_jobs where target_id = '60000000-0000-0000-0000-000000000102'),
  1::bigint,
  'a duplicate event should not enqueue another deletion job'
);

create temporary table first_claim as
select * from public.claim_deletion_jobs(1);

select is(
  (select status::text || ':' || attempts from public.deletion_jobs where id = (select id from first_claim)),
  'processing:1',
  'claiming should lock the job and increment attempts'
);
select is(
  public.finish_deletion_job(
    (select id from first_claim),
    false,
    'temporary provider error',
    now()
  ),
  true,
  'a retryable provider failure should update the claimed job'
);
select is(
  (select status from public.deletion_jobs where id = (select id from first_claim)),
  'queued'::public.job_status,
  'a retryable failure should return the job to the queue'
);

create temporary table second_claim as
select * from public.claim_deletion_jobs(1);

select is(
  (select attempts from second_claim),
  2::smallint,
  'a retry claim should increment attempts again'
);
select is(
  public.finish_deletion_job((select id from second_claim), true, null, null),
  true,
  'a successful provider deletion should finish the job'
);
select is(
  (select status from public.deletion_jobs where id = (select id from second_claim)),
  'completed'::public.job_status,
  'a successful deletion should be terminal'
);

select tests.authenticate_as('00000000-0000-0000-0000-000000000201');
set local role authenticated;

select is((select count(*) from public.video_assets), 2::bigint, 'a room member should select video states');
select throws_ok(
  $$select * from public.mux_events$$,
  '42501',
  null,
  'a room member should not select server webhook events'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000202');
set local role authenticated;

select is((select count(*) from public.video_assets), 0::bigint, 'a non-member should not select video states');
select throws_ok(
  $$select public.claim_deletion_jobs(1)$$,
  '42501',
  null,
  'an authenticated user should not claim server deletion jobs'
);

reset role;
set local role anon;

select throws_ok(
  $$select * from public.video_assets$$,
  '42501',
  null,
  'anon should not select video states'
);

reset role;

select * from finish();

rollback;
