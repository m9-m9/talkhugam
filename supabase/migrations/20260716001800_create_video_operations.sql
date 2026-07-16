create type public.video_status as enum (
  'waiting_upload',
  'processing',
  'ready',
  'failed',
  'deleted'
);
create type public.webhook_status as enum ('processing', 'processed', 'failed');
create type public.deletion_scope as enum ('post', 'room', 'account');
create type public.job_status as enum ('queued', 'processing', 'completed', 'failed');

create table public.video_assets (
  post_id uuid primary key references public.posts (id) on delete cascade,
  mux_upload_id text not null unique,
  mux_asset_id text unique,
  playback_id text unique,
  status public.video_status not null default 'waiting_upload',
  duration_seconds numeric(6, 3),
  aspect_ratio text,
  error_code text,
  ready_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint video_assets_duration_range
    check (duration_seconds is null or duration_seconds between 0 and 999.999),
  constraint video_assets_aspect_ratio_format
    check (aspect_ratio is null or aspect_ratio ~ '^\d+(\.\d+)?:\d+(\.\d+)?$'),
  constraint video_assets_status_shape
    check (
      (status = 'waiting_upload' and ready_at is null and deleted_at is null)
      or (status = 'processing' and mux_asset_id is not null and ready_at is null and deleted_at is null)
      or (
        status = 'ready'
        and mux_asset_id is not null
        and playback_id is not null
        and duration_seconds between 0 and 30
        and ready_at is not null
        and deleted_at is null
      )
      or (status = 'failed' and error_code is not null and deleted_at is null)
      or (status = 'deleted' and deleted_at is not null)
    )
);

create table public.mux_events (
  event_id text primary key,
  event_type text not null,
  object_id text,
  status public.webhook_status not null default 'processing',
  attempts smallint not null default 1,
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  constraint mux_events_id_not_blank check (char_length(btrim(event_id)) between 1 and 200),
  constraint mux_events_type_not_blank check (char_length(btrim(event_type)) between 1 and 200),
  constraint mux_events_attempts_positive check (attempts > 0),
  constraint mux_events_status_shape
    check (
      (status = 'processing' and processed_at is null)
      or (status = 'processed' and processed_at is not null and last_error is null)
      or (status = 'failed' and processed_at is not null and last_error is not null)
    )
);

create table public.deletion_jobs (
  id uuid primary key default gen_random_uuid(),
  scope public.deletion_scope not null,
  target_id uuid not null,
  provider text not null default 'mux',
  status public.job_status not null default 'queued',
  attempts smallint not null default 0,
  next_retry_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint deletion_jobs_provider_not_blank
    check (char_length(btrim(provider)) between 1 and 40),
  constraint deletion_jobs_attempts_range check (attempts between 0 and 5),
  constraint deletion_jobs_status_shape
    check (
      (status = 'queued' and finished_at is null)
      or (status = 'processing' and attempts > 0 and finished_at is null)
      or (status = 'completed' and finished_at is not null and last_error is null)
      or (status = 'failed' and attempts > 0 and finished_at is not null and last_error is not null)
    )
);

create unique index deletion_jobs_active_target_unique
on public.deletion_jobs (scope, target_id, provider)
where status in ('queued', 'processing');

create index video_assets_status_updated_at_idx
on public.video_assets (status, updated_at);

create index mux_events_status_created_at_idx
on public.mux_events (status, created_at);

create index deletion_jobs_claim_idx
on public.deletion_jobs (status, next_retry_at, created_at)
where status = 'queued';

create trigger video_assets_set_updated_at
before update on public.video_assets
for each row execute function private.set_updated_at();

comment on table public.video_assets is 'Private Mux upload, processing, and signed playback state for one root video post';
comment on table public.mux_events is 'Verified Mux webhook event ids used for atomic idempotency';
comment on table public.deletion_jobs is 'Retryable external provider deletion work without user content payloads';
