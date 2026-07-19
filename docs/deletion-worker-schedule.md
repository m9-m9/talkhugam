# 삭제 worker 운영 스케줄

책방·영상·계정 삭제는 즉시 DB에서 숨기고, 실제 Mux 자산 삭제는 `deletion-worker`가 대기열에서 처리한다.
이 문서는 Supabase Cron이 1분마다 worker를 호출하도록 준비·검증하는 절차다.

## 구성

- `pg_cron`: 매분 `private.invoke_deletion_worker()`를 실행한다.
- `pg_net`: DB에서 `deletion-worker` Edge Function으로 비동기 POST 요청을 보낸다.
- Supabase Vault: 프로젝트 URL, Publishable key, worker 전용 비밀값을 암호화해 보관한다.
- `deletion-worker`: Vault의 worker 전용 비밀값과 같은 `Authorization` 헤더만 허용한다.

`20260718000400_schedule_deletion_worker.sql` migration은 Cron job 이름
`talkhugam-deletion-worker`를 만들거나 같은 이름의 기존 job을 갱신한다.

## 운영 배포 전 Vault 설정

이 단계는 **migration을 운영 프로젝트에 적용하기 전에 한 번만** 한다. 값은 코드, Notion, 채팅에
붙여 넣지 않는다.

1. [Supabase Dashboard](https://supabase.com/dashboard/project/gvuwtaxvoinelqdvrher)에서 Talk후감 프로젝트를 연다.
2. 왼쪽 메뉴에서 **SQL Editor**를 누르고, 오른쪽 위 **New query**를 누른다.
3. 아래 SQL의 `<...>` 세 곳만 실제 값으로 바꾼다.
   - `<PUBLISHABLE_KEY>`: **Project Settings → API Keys → Publishable key** 값
   - `<DELETION_WORKER_SECRET>`: 이미 Edge Function secret으로 저장한
     `DELETION_WORKER_SECRET`과 **완전히 같은 값**
   - 프로젝트 URL은 이미 실제 Talk후감 project ref로 채워져 있다.

```sql
select vault.create_secret(
  'https://gvuwtaxvoinelqdvrher.supabase.co',
  'talkhugam_project_url',
  'Talk후감 Edge Function 프로젝트 URL'
);

select vault.create_secret(
  '<PUBLISHABLE_KEY>',
  'talkhugam_publishable_key',
  'Talk후감 Cron의 Edge Function API key'
);

select vault.create_secret(
  '<DELETION_WORKER_SECRET>',
  'talkhugam_deletion_worker_secret',
  'Talk후감 deletion-worker 전용 Authorization 값'
);
```

4. **Run**을 누른다. 결과에 UUID가 세 개 보이면 생성 성공이다. 값은 결과 화면이나 캡처에 남기지 않는다.
5. 이미 같은 이름의 Vault secret이 있다면 새로 만들지 않는다. 아래 조회로 UUID만 확인한 후,
   바꿔야 하는 값이 있을 때만 `vault.update_secret()`을 사용한다.

```sql
select id, name, updated_at
from vault.decrypted_secrets
where name in (
  'talkhugam_project_url',
  'talkhugam_publishable_key',
  'talkhugam_deletion_worker_secret'
)
order by name;
```

```sql
select vault.update_secret(
  '<위 조회의 id>'::uuid,
  '<새 값>',
  '<같은 name>',
  '<기존 설명>'
);
```

## migration 적용과 첫 확인

Vault 설정 후 저장소 루트에서 다음을 실행한다.

```bash
pnpm dlx supabase@latest db push --project-ref gvuwtaxvoinelqdvrher
pnpm dlx supabase@latest functions deploy deletion-worker \
  --project-ref gvuwtaxvoinelqdvrher \
  --no-verify-jwt
```

그 다음 Dashboard에서 다음을 확인한다.

1. **Integrations → Cron**에서 `talkhugam-deletion-worker`가 1분 간격으로 활성화되어 있는지 확인한다.
2. 1~2분 뒤 같은 화면의 실행 기록에서 최근 run이 성공인지 확인한다.
3. **SQL Editor → New query**에서 아래 SQL을 실행한다. `deletionDue`와 `deletionFailed`가
   처리할 삭제 작업이 없을 때 `0`인지 확인한다.

```sql
select public.backend_operational_health();
```

## 장애 확인과 중지

- Cron이 실패하면 먼저 Vault 이름 세 개와 Edge Function의 `DELETION_WORKER_SECRET` 값이 같은지 확인한다.
- worker 로그에는 이메일, 채팅, 토큰, 영상 URL을 남기지 않는다.
- 긴급 중지는 **Integrations → Cron → talkhugam-deletion-worker → Disable**에서 한다.
- 삭제 처리가 재개되면 실행 기록과 `backend_operational_health()`의 `deletionDue`, `deletionFailed`를 함께 확인한다.

## 공식 참고

- [Supabase: Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions)
- [Supabase: Vault](https://supabase.com/docs/guides/database/vault)
- [Supabase: Cron](https://supabase.com/docs/guides/cron)
