begin;

select plan(6);

select ok(
  exists(select 1 from pg_extension where extname = 'pg_net'),
  '삭제 worker 호출에 pg_net 확장이 활성화되어야 한다'
);

select ok(
  exists(select 1 from pg_extension where extname = 'pg_cron'),
  '삭제 worker 스케줄링에 pg_cron 확장이 활성화되어야 한다'
);

select has_function(
  'private',
  'invoke_deletion_worker',
  array[]::text[],
  'Vault 비밀값으로 worker를 호출하는 내부 함수가 존재해야 한다'
);

select is(
  has_function_privilege('anon', 'private.invoke_deletion_worker()', 'EXECUTE'),
  false,
  'anon은 삭제 worker 스케줄 함수를 실행할 수 없어야 한다'
);

select is(
  has_function_privilege('authenticated', 'private.invoke_deletion_worker()', 'EXECUTE'),
  false,
  '인증 사용자는 삭제 worker 스케줄 함수를 실행할 수 없어야 한다'
);

select is(
  (
    select schedule
    from cron.job
    where jobname = 'talkhugam-deletion-worker'
  ),
  '* * * * *',
  '삭제 worker는 1분마다 실행되도록 예약되어야 한다'
);

select * from finish();

rollback;
