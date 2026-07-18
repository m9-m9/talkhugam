create extension if not exists pg_net;
create extension if not exists pg_cron;

create or replace function private.invoke_bestseller_refresh()
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  v_project_url text;
  v_publishable_key text;
  v_refresh_secret text;
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
  into v_refresh_secret
  from vault.decrypted_secrets
  where name = 'talkhugam_bestseller_refresh_secret';

  if v_project_url is null or v_publishable_key is null or v_refresh_secret is null then
    raise exception using
      errcode = 'P0001',
      message = 'BESTSELLER_REFRESH_VAULT_SECRET_MISSING';
  end if;

  return net.http_post(
    url := rtrim(v_project_url, '/') || '/functions/v1/bestseller-refresh',
    headers := jsonb_build_object(
      'apikey', v_publishable_key,
      'authorization', 'Bearer ' || v_refresh_secret,
      'content-type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  );
end;
$$;

revoke all on function private.invoke_bestseller_refresh() from public, anon, authenticated;

do $schedule$
declare
  v_existing_job_id bigint;
begin
  select jobid
  into v_existing_job_id
  from cron.job
  where jobname = 'talkhugam-bestseller-refresh';

  if v_existing_job_id is not null then
    perform cron.unschedule(v_existing_job_id);
  end if;

  perform cron.schedule(
    'talkhugam-bestseller-refresh',
    '5 22 * * *',
    'select private.invoke_bestseller_refresh();'
  );
end;
$schedule$;

comment on function private.invoke_bestseller_refresh()
is 'Vault의 전용 갱신 비밀값으로 매일 07:05 KST에 bestseller-refresh Edge Function을 호출한다.';
