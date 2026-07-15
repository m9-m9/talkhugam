begin;

\ir ../helpers/auth.inc

select plan(22);

select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000211',
  'delete-anonymize@test.local',
  '익명 보존 사용자'
);
select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000212',
  'delete-new-owner@test.local',
  '새 방장'
);
select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000213',
  'delete-content@test.local',
  '콘텐츠 삭제 사용자'
);

insert into public.reading_rooms (id, name, created_by)
values
  (
    '10000000-0000-0000-0000-000000000111',
    '익명 보존 공유 방',
    '00000000-0000-0000-0000-000000000211'
  ),
  (
    '10000000-0000-0000-0000-000000000112',
    '콘텐츠 삭제 단독 방',
    '00000000-0000-0000-0000-000000000213'
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
    '20000000-0000-0000-0000-000000000111',
    '10000000-0000-0000-0000-000000000111',
    '00000000-0000-0000-0000-000000000211',
    'owner',
    '익명 보존 사용자'
  ),
  (
    '20000000-0000-0000-0000-000000000112',
    '10000000-0000-0000-0000-000000000111',
    '00000000-0000-0000-0000-000000000212',
    'member',
    '새 방장'
  ),
  (
    '20000000-0000-0000-0000-000000000113',
    '10000000-0000-0000-0000-000000000112',
    '00000000-0000-0000-0000-000000000213',
    'owner',
    '콘텐츠 삭제 사용자'
  );

insert into public.books (id, source, title)
values
  ('40000000-0000-0000-0000-000000000111', 'manual', '익명 보존 책'),
  ('40000000-0000-0000-0000-000000000112', 'manual', '콘텐츠 삭제 책');

insert into public.book_chats (id, room_id, book_id, created_by_member_id, name)
values
  (
    '50000000-0000-0000-0000-000000000111',
    '10000000-0000-0000-0000-000000000111',
    '40000000-0000-0000-0000-000000000111',
    '20000000-0000-0000-0000-000000000111',
    '익명 보존 채팅'
  ),
  (
    '50000000-0000-0000-0000-000000000112',
    '10000000-0000-0000-0000-000000000112',
    '40000000-0000-0000-0000-000000000112',
    '20000000-0000-0000-0000-000000000113',
    '콘텐츠 삭제 채팅'
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
    '60000000-0000-0000-0000-000000000111',
    '50000000-0000-0000-0000-000000000111',
    '20000000-0000-0000-0000-000000000111',
    'text',
    '보존할 공동 기록',
    '70000000-0000-0000-0000-000000000111',
    '익명 보존 사용자'
  ),
  (
    '60000000-0000-0000-0000-000000000112',
    '50000000-0000-0000-0000-000000000112',
    '20000000-0000-0000-0000-000000000113',
    'video',
    '삭제할 영상 기록',
    '70000000-0000-0000-0000-000000000112',
    '콘텐츠 삭제 사용자'
  );

insert into public.post_labels (post_id, kind, value)
values
  ('60000000-0000-0000-0000-000000000111', 'page', '12페이지'),
  ('60000000-0000-0000-0000-000000000112', 'custom', '삭제 라벨');

insert into public.post_mentions (post_id, mentioned_member_id)
values
  ('60000000-0000-0000-0000-000000000111', '20000000-0000-0000-0000-000000000112'),
  ('60000000-0000-0000-0000-000000000112', '20000000-0000-0000-0000-000000000113');

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
  '60000000-0000-0000-0000-000000000112',
  'delete-upload-112',
  'delete-asset-112',
  'delete-playback-112',
  'ready',
  20,
  now()
);

select tests.authenticate_as('00000000-0000-0000-0000-000000000211');
set local role authenticated;

select throws_ok(
  $$
    select * from public.prepare_account_deletion(
      'anonymize',
      '80000000-0000-0000-0000-000000000111'
    )
  $$,
  'P0001',
  'OWNER_TRANSFER_REQUIRED',
  'a populated room owner should transfer ownership before account deletion'
);
select lives_ok(
  $$
    select public.transfer_room_ownership(
      '10000000-0000-0000-0000-000000000111',
      '20000000-0000-0000-0000-000000000112'
    )
  $$,
  'the owner should be able to transfer ownership before deletion'
);

create temporary table anonymize_result as
select * from public.prepare_account_deletion(
  'anonymize',
  '80000000-0000-0000-0000-000000000111'
);

select is(
  (select request_id from anonymize_result),
  '80000000-0000-0000-0000-000000000111'::uuid,
  'anonymize should return its deletion request id'
);

reset role;

select is(
  (select body from public.posts where id = '60000000-0000-0000-0000-000000000111'),
  '보존할 공동 기록',
  'anonymize should preserve the shared post body'
);
select is(
  (
    select (author_member_id is null)::text || ':' || author_name_snapshot
    from public.posts
    where id = '60000000-0000-0000-0000-000000000111'
  ),
  'true:탈퇴한 사용자',
  'anonymize should remove the author link and replace its snapshot'
);
select is(
  (select count(*) from public.post_labels where post_id = '60000000-0000-0000-0000-000000000111'),
  1::bigint,
  'anonymize should preserve post labels'
);
select is(
  (
    select (profile_id is null)::text || ':' || status::text
    from public.room_members
    where id = '20000000-0000-0000-0000-000000000111'
  ),
  'true:left',
  'anonymize should detach and close the membership'
);
select is(
  (select count(*) from public.deletion_jobs where target_id = '60000000-0000-0000-0000-000000000111'),
  0::bigint,
  'anonymize should not delete preserved post media'
);

select tests.authenticate_as('00000000-0000-0000-0000-000000000211');
set local role authenticated;

select is(
  (
    select request_id
    from public.prepare_account_deletion(
      'anonymize',
      '80000000-0000-0000-0000-000000000119'
    )
  ),
  '80000000-0000-0000-0000-000000000111'::uuid,
  'an anonymize retry should return the first request id'
);
select throws_ok(
  $$
    select * from public.prepare_account_deletion(
      'delete_content',
      '80000000-0000-0000-0000-000000000118'
    )
  $$,
  'P0001',
  'CONFLICT',
  'a retry should not change the selected deletion mode'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000213');
set local role authenticated;

create temporary table delete_result as
select * from public.prepare_account_deletion(
  'delete_content',
  '80000000-0000-0000-0000-000000000112'
);

reset role;

select is(
  (select status from public.reading_rooms where id = '10000000-0000-0000-0000-000000000112'),
  'deleted'::public.room_status,
  'a sole-owner room should be deleted during account deletion'
);
select is(
  (
    select (body is null and deleted_at is not null and author_member_id is null)
    from public.posts
    where id = '60000000-0000-0000-0000-000000000112'
  ),
  true,
  'delete_content should tombstone the authored post'
);
select is(
  (select count(*) from public.post_labels where post_id = '60000000-0000-0000-0000-000000000112'),
  0::bigint,
  'delete_content should remove labels'
);
select is(
  (select count(*) from public.post_mentions where post_id = '60000000-0000-0000-0000-000000000112'),
  0::bigint,
  'delete_content should remove mentions'
);
select is(
  (select status from public.video_assets where post_id = '60000000-0000-0000-0000-000000000112'),
  'ready'::public.video_status,
  'video metadata should remain until the external deletion worker succeeds'
);
select is(
  (
    select count(*)
    from public.deletion_jobs
    where target_id in (
      '10000000-0000-0000-0000-000000000112',
      '60000000-0000-0000-0000-000000000112'
    )
  ),
  2::bigint,
  'delete_content should enqueue room and authored-post media deletion'
);
select is(
  (
    select (profile_id is null)::text || ':' || room_display_name
    from public.room_members
    where id = '20000000-0000-0000-0000-000000000113'
  ),
  'true:탈퇴한 사용자',
  'delete_content should detach and anonymize the membership'
);
select is(
  public.finish_account_deletion(
    '80000000-0000-0000-0000-000000000112',
    false,
    'temporary auth failure'
  ),
  true,
  'an Auth deletion failure should be recorded'
);
select is(
  (
    select status
    from private.account_deletion_requests
    where id = '80000000-0000-0000-0000-000000000112'
  ),
  'failed'::public.account_deletion_status,
  'a failed Auth handoff should remain retryable'
);

select tests.authenticate_as('00000000-0000-0000-0000-000000000213');
set local role authenticated;

select is(
  (
    select request_id
    from public.prepare_account_deletion(
      'delete_content',
      '80000000-0000-0000-0000-000000000117'
    )
  ),
  '80000000-0000-0000-0000-000000000112'::uuid,
  'a failed handoff retry should reuse the prepared request'
);

reset role;

select is(
  public.finish_account_deletion(
    '80000000-0000-0000-0000-000000000112',
    true,
    null
  ),
  true,
  'a successful Auth handoff should finish the request'
);
select is(
  (
    select status
    from private.account_deletion_requests
    where id = '80000000-0000-0000-0000-000000000112'
  ),
  'auth_deleted'::public.account_deletion_status,
  'a successful Auth deletion should be terminal'
);

select * from finish();

rollback;
