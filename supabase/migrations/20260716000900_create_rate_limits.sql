create table private.api_rate_limits (
  bucket text not null,
  subject text not null,
  request_count integer not null default 0,
  reset_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (bucket, subject),
  constraint api_rate_limits_bucket_not_blank
    check (char_length(btrim(bucket)) between 1 and 80),
  constraint api_rate_limits_subject_not_blank
    check (char_length(btrim(subject)) between 1 and 200),
  constraint api_rate_limits_request_count_nonnegative
    check (request_count >= 0)
);

create or replace function public.consume_rate_limit(
  p_bucket text,
  p_subject text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  v_rate_limit private.api_rate_limits%rowtype;
begin
  if char_length(btrim(p_bucket)) not between 1 and 80
    or char_length(btrim(p_subject)) not between 1 and 200
    or p_limit < 1
    or p_window_seconds not between 1 and 86400
  then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  insert into private.api_rate_limits (
    bucket,
    subject,
    request_count,
    reset_at
  )
  values (
    btrim(p_bucket),
    btrim(p_subject),
    0,
    now() + make_interval(secs => p_window_seconds)
  )
  on conflict (bucket, subject) do nothing;

  select *
  into v_rate_limit
  from private.api_rate_limits
  where bucket = btrim(p_bucket) and subject = btrim(p_subject)
  for update;

  if v_rate_limit.reset_at <= now() then
    update private.api_rate_limits
    set
      request_count = 1,
      reset_at = now() + make_interval(secs => p_window_seconds),
      updated_at = now()
    where bucket = v_rate_limit.bucket and subject = v_rate_limit.subject;

    return true;
  end if;

  if v_rate_limit.request_count >= p_limit then
    return false;
  end if;

  update private.api_rate_limits
  set request_count = request_count + 1, updated_at = now()
  where bucket = v_rate_limit.bucket and subject = v_rate_limit.subject;

  return true;
end;
$$;

revoke all on function public.consume_rate_limit(text, text, integer, integer)
from public, anon, authenticated;

grant execute on function public.consume_rate_limit(text, text, integer, integer)
to service_role;

comment on table private.api_rate_limits is 'Short-lived server-side fixed-window rate limit counters';
