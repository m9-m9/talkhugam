create extension if not exists pg_net;
create extension if not exists pg_cron;

create or replace function private.invoke_deletion_worker()
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  v_project_url text;
  v_publishable_key text;
  v_worker_secret text;
begin
  select decrypted_secret
  into v_project_url
  from vault.decrypted_secrets
  where name = 'talkhugam_project_url';

  select decrypted_secret
  into v_publishable_key
  from vault.decrypted_secrets
  where name = 'talkhugam_publishable_key';

  select decrypted_secret
  into v_worker_secret
  from vault.decrypted_secrets
  where name = 'talkhugam_deletion_worker_secret';

  if v_project_url is null or v_publishable_key is null or v_worker_secret is null then
    raise exception using
      errcode = 'P0001',
      message = 'DELETION_WORKER_VAULT_SECRET_MISSING';
  end if;

  return net.http_post(
    url := rtrim(v_project_url, '/') || '/functions/v1/deletion-worker',
    headers := jsonb_build_object(
      'apikey', v_publishable_key,
      'authorization', 'Bearer ' || v_worker_secret,
      'content-type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  );
end;
$$;

revoke all on function private.invoke_deletion_worker() from public, anon, authenticated;

do $schedule$
declare
  v_existing_job_id bigint;
begin
  select jobid
  into v_existing_job_id
  from cron.job
  where jobname = 'talkhugam-deletion-worker';

  if v_existing_job_id is not null then
    perform cron.unschedule(v_existing_job_id);
  end if;

  perform cron.schedule(
    'talkhugam-deletion-worker',
    '* * * * *',
    'select private.invoke_deletion_worker();'
  );
end;
$schedule$;

comment on function private.invoke_deletion_worker()
is 'Vault의 운영 비밀값으로 deletion-worker Edge Function을 호출한다.';
