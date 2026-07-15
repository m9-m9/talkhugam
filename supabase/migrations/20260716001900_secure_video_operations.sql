create or replace function private.validate_video_asset_post()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not exists (
    select 1
    from public.posts
    where id = new.post_id
      and type = 'video'
      and depth = 0
      and deleted_at is null
  ) then
    raise exception using errcode = 'P0001', message = 'POST_NOT_FOUND';
  end if;

  return new;
end;
$$;

create trigger video_assets_validate_post
before insert or update of post_id on public.video_assets
for each row execute function private.validate_video_asset_post();

create or replace function private.enqueue_deletion_job(
  p_scope public.deletion_scope,
  p_target_id uuid,
  p_provider text default 'mux'
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_job_id uuid;
begin
  if p_target_id is null
    or char_length(btrim(p_provider)) not between 1 and 40
  then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  insert into public.deletion_jobs (scope, target_id, provider)
  values (p_scope, p_target_id, btrim(p_provider))
  on conflict (scope, target_id, provider)
    where status in ('queued', 'processing')
    do update set next_retry_at = least(
      coalesce(deletion_jobs.next_retry_at, now()),
      now()
    )
  returning id into v_job_id;

  return v_job_id;
end;
$$;

create or replace function public.apply_mux_video_event(
  p_event_id text,
  p_event_type text,
  p_post_id uuid,
  p_status public.video_status,
  p_object_id text default null,
  p_mux_asset_id text default null,
  p_playback_id text default null,
  p_duration_seconds numeric default null,
  p_aspect_ratio text default null,
  p_error_code text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_event_id text;
  v_asset public.video_assets%rowtype;
begin
  if char_length(btrim(p_event_id)) not between 1 and 200
    or char_length(btrim(p_event_type)) not between 1 and 200
    or p_post_id is null
    or p_status is null
  then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  if p_status in ('processing', 'ready')
    and nullif(btrim(p_mux_asset_id), '') is null
  then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  if p_status = 'ready'
    and (
      p_duration_seconds is null
      or p_duration_seconds < 0
      or nullif(btrim(p_playback_id), '') is null
    )
  then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  insert into public.mux_events (event_id, event_type, object_id)
  values (btrim(p_event_id), btrim(p_event_type), nullif(btrim(p_object_id), ''))
  on conflict (event_id) do nothing
  returning event_id into v_event_id;

  if v_event_id is null then
    return false;
  end if;

  select *
  into v_asset
  from public.video_assets
  where post_id = p_post_id
  for update;

  if v_asset.post_id is null then
    raise exception using errcode = 'P0001', message = 'POST_NOT_FOUND';
  end if;

  if p_status = 'processing' and v_asset.status = 'waiting_upload' then
    update public.video_assets
    set
      status = 'processing',
      mux_asset_id = coalesce(nullif(btrim(p_mux_asset_id), ''), mux_asset_id),
      aspect_ratio = coalesce(nullif(btrim(p_aspect_ratio), ''), aspect_ratio)
    where post_id = p_post_id;
  end if;

  if p_status = 'ready'
    and v_asset.status in ('waiting_upload', 'processing')
    and p_duration_seconds > 30
  then
    update public.video_assets
    set
      status = 'failed',
      mux_asset_id = coalesce(nullif(btrim(p_mux_asset_id), ''), mux_asset_id),
      duration_seconds = p_duration_seconds,
      error_code = 'VIDEO_TOO_LONG'
    where post_id = p_post_id;

    perform private.enqueue_deletion_job('post', p_post_id, 'mux');
  end if;

  if p_status = 'ready'
    and v_asset.status in ('waiting_upload', 'processing')
    and p_duration_seconds between 0 and 30
  then
    update public.video_assets
    set
      status = 'ready',
      mux_asset_id = coalesce(nullif(btrim(p_mux_asset_id), ''), mux_asset_id),
      playback_id = nullif(btrim(p_playback_id), ''),
      duration_seconds = p_duration_seconds,
      aspect_ratio = nullif(btrim(p_aspect_ratio), ''),
      error_code = null,
      ready_at = now()
    where post_id = p_post_id;
  end if;

  if p_status = 'failed' and v_asset.status in ('waiting_upload', 'processing') then
    update public.video_assets
    set
      status = 'failed',
      mux_asset_id = coalesce(nullif(btrim(p_mux_asset_id), ''), mux_asset_id),
      error_code = coalesce(nullif(btrim(p_error_code), ''), 'VIDEO_PROCESSING_FAILED')
    where post_id = p_post_id;
  end if;

  if p_status = 'deleted' and v_asset.status <> 'deleted' then
    update public.video_assets
    set status = 'deleted', deleted_at = now()
    where post_id = p_post_id;
  end if;

  update public.mux_events
  set status = 'processed', processed_at = now()
  where event_id = v_event_id;

  return true;
end;
$$;

create or replace function public.claim_deletion_jobs(p_limit integer default 10)
returns table (
  id uuid,
  scope public.deletion_scope,
  target_id uuid,
  provider text,
  attempts smallint
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_limit is null or p_limit not between 1 and 50 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  return query
  with claimable as (
    select job.id
    from public.deletion_jobs as job
    where job.status = 'queued'
      and (job.next_retry_at is null or job.next_retry_at <= now())
    order by job.created_at
    limit p_limit
    for update skip locked
  )
  update public.deletion_jobs as job
  set
    status = 'processing',
    attempts = job.attempts + 1,
    next_retry_at = null
  from claimable
  where job.id = claimable.id
  returning job.id, job.scope, job.target_id, job.provider, job.attempts;
end;
$$;

create or replace function public.finish_deletion_job(
  p_job_id uuid,
  p_succeeded boolean,
  p_last_error text default null,
  p_next_retry_at timestamptz default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_job public.deletion_jobs%rowtype;
begin
  select *
  into v_job
  from public.deletion_jobs
  where id = p_job_id
  for update;

  if v_job.id is null or v_job.status <> 'processing' then
    return false;
  end if;

  if p_succeeded then
    update public.deletion_jobs
    set
      status = 'completed',
      last_error = null,
      next_retry_at = null,
      finished_at = now()
    where id = p_job_id;

    return true;
  end if;

  if v_job.attempts >= 5 or p_next_retry_at is null then
    update public.deletion_jobs
    set
      status = 'failed',
      last_error = coalesce(nullif(btrim(p_last_error), ''), 'DELETE_FAILED'),
      next_retry_at = null,
      finished_at = now()
    where id = p_job_id;

    return true;
  end if;

  update public.deletion_jobs
  set
    status = 'queued',
    last_error = coalesce(nullif(btrim(p_last_error), ''), 'DELETE_RETRY'),
    next_retry_at = p_next_retry_at,
    finished_at = null
  where id = p_job_id;

  return true;
end;
$$;

revoke all on function private.validate_video_asset_post() from public, anon, authenticated;
revoke all on function private.enqueue_deletion_job(public.deletion_scope, uuid, text)
from public, anon, authenticated;
revoke all on function public.apply_mux_video_event(
  text, text, uuid, public.video_status, text, text, text, numeric, text, text
) from public, anon, authenticated;
revoke all on function public.claim_deletion_jobs(integer) from public, anon, authenticated;
revoke all on function public.finish_deletion_job(uuid, boolean, text, timestamptz)
from public, anon, authenticated;

grant execute on function public.apply_mux_video_event(
  text, text, uuid, public.video_status, text, text, text, numeric, text, text
) to service_role;
grant execute on function public.claim_deletion_jobs(integer) to service_role;
grant execute on function public.finish_deletion_job(uuid, boolean, text, timestamptz)
to service_role;

alter table public.video_assets enable row level security;
alter table public.mux_events enable row level security;
alter table public.deletion_jobs enable row level security;

revoke all on table public.video_assets from anon, authenticated;
revoke all on table public.mux_events from anon, authenticated;
revoke all on table public.deletion_jobs from anon, authenticated;

grant select on table public.video_assets to authenticated;
grant all on table public.video_assets to service_role;
grant all on table public.mux_events to service_role;
grant all on table public.deletion_jobs to service_role;

create policy video_assets_select_active_room_member
on public.video_assets
for select
to authenticated
using (private.can_access_post(post_id));

comment on function public.apply_mux_video_event(
  text, text, uuid, public.video_status, text, text, text, numeric, text, text
) is 'Atomically deduplicates a verified Mux event and applies a monotonic video state transition';
comment on function public.claim_deletion_jobs(integer)
is 'Claims due external deletion jobs with row locks and SKIP LOCKED';
