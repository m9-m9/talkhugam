create or replace function public.backend_operational_health()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select jsonb_build_object(
    'videoWaitingOver15m', (
      select count(*)
      from public.video_assets
      where status = 'waiting_upload'
        and created_at < now() - interval '15 minutes'
    ),
    'videoProcessingOver15m', (
      select count(*)
      from public.video_assets
      where status = 'processing'
        and updated_at < now() - interval '15 minutes'
    ),
    'videoFailed', (
      select count(*) from public.video_assets where status = 'failed'
    ),
    'webhookProcessingOver5m', (
      select count(*)
      from public.mux_events
      where status = 'processing'
        and created_at < now() - interval '5 minutes'
    ),
    'webhookFailed', (
      select count(*) from public.mux_events where status = 'failed'
    ),
    'deletionDue', (
      select count(*)
      from public.deletion_jobs
      where status = 'queued'
        and (next_retry_at is null or next_retry_at <= now())
    ),
    'deletionFailed', (
      select count(*) from public.deletion_jobs where status = 'failed'
    ),
    'accountDeletionFailed', (
      select count(*)
      from private.account_deletion_requests
      where status = 'failed'
    ),
    'accountDeletionCompletionPending', (
      select count(*)
      from private.account_deletion_requests
      where status = 'prepared'
        and updated_at < now() - interval '5 minutes'
    ),
    'checkedAt', now()
  );
$$;

comment on function public.backend_operational_health()
is 'Mux·영상·삭제 작업의 개인정보 없는 운영 상태 수를 제공한다.';
