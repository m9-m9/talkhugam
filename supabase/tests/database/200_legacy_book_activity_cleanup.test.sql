begin;

select plan(5);

select is(
  (
    select count(*)
    from pg_trigger
    where tgrelid = 'public.book_chat_completions'::regclass
      and tgname = 'book_chat_completions_notify_review'
      and not tgisinternal
  ),
  0::bigint,
  '완독 알림을 중복 생성하던 이전 트리거가 없다'
);

select is(
  (
    select count(*)
    from pg_trigger
    where tgrelid = 'public.video_assets'::regclass
      and tgname = 'video_assets_notify_ready'
      and not tgisinternal
  ),
  0::bigint,
  '영상 알림을 중복 생성하던 이전 트리거가 없다'
);

select is(
  (
    select count(*)
    from pg_proc as procedure
    join pg_namespace as schema on schema.oid = procedure.pronamespace
    where schema.nspname = 'private'
      and procedure.proname = 'enqueue_book_activity_notifications'
  ),
  0::bigint,
  '이전 책 활동 알림 함수가 없다'
);

select is(
  (
    select count(*)
    from pg_proc as procedure
    join pg_namespace as schema on schema.oid = procedure.pronamespace
    where schema.nspname = 'private'
      and procedure.proname = 'notify_completion_review'
  ),
  0::bigint,
  '이전 완독 알림 트리거 함수가 없다'
);

select is(
  (
    select count(*)
    from pg_proc as procedure
    join pg_namespace as schema on schema.oid = procedure.pronamespace
    where schema.nspname = 'private'
      and procedure.proname = 'notify_ready_video'
  ),
  0::bigint,
  '이전 영상 알림 트리거 함수가 없다'
);

select * from finish();

rollback;
