begin;

select plan(6);

insert into public.mux_events (
  event_id,
  event_type,
  status,
  processed_at,
  last_error
)
values (
  'health-failed-event',
  'video.asset.errored',
  'failed',
  now(),
  'NORMALIZED_ERROR'
);

insert into public.deletion_jobs (
  scope,
  target_id,
  status
)
values (
  'post',
  '60000000-0000-0000-0000-000000000141',
  'queued'
);

insert into private.account_deletion_requests (
  id,
  profile_id,
  mode,
  status,
  last_error
)
values (
  '80000000-0000-0000-0000-000000000141',
  '00000000-0000-0000-0000-000000000141',
  'anonymize',
  'failed',
  'AUTH_DELETE_FAILED'
);

insert into private.account_deletion_requests (
  id,
  profile_id,
  mode,
  status,
  updated_at
)
values (
  '80000000-0000-0000-0000-000000000142',
  '00000000-0000-0000-0000-000000000142',
  'anonymize',
  'prepared',
  now() - interval '6 minutes'
);

create temporary table health_result as
select public.backend_operational_health() as value;

select is(
  ((select value from health_result) ->> 'webhookFailed')::integer,
  1,
  'health should count normalized failed webhook rows'
);
select is(
  ((select value from health_result) ->> 'deletionDue')::integer,
  1,
  'health should count due deletion work'
);
select is(
  ((select value from health_result) ->> 'accountDeletionFailed')::integer,
  1,
  'health should count failed Auth deletion handoffs'
);
select is(
  ((select value from health_result) ->> 'accountDeletionCompletionPending')::integer,
  1,
  'health should count deletion records pending completion after Auth deletion'
);
select ok(
  (select value from health_result) ? 'checkedAt',
  'health should include its check timestamp'
);
select is(
  has_function_privilege('authenticated', 'public.backend_operational_health()', 'EXECUTE'),
  false,
  'operational health should be service-role only'
);

select * from finish();

rollback;
