# 삭제 worker 운영 스케줄 구현 계획

**목표:** 독서방·영상·계정 삭제로 등록된 Mux 자산 삭제 대기열을 사람이 수동 호출하지 않아도 안정적으로 처리한다.

## 문제

1. 삭제 RPC는 `deletion_jobs`에 작업을 등록한다.
2. `deletion-worker` Edge Function은 작업을 claim하고 Mux 자산을 삭제할 수 있다.
3. 그러나 worker를 정기 호출하는 Cron 또는 외부 스케줄러가 없었다.

## 결정

Supabase hosted platform의 `pg_cron`과 `pg_net`을 사용한다.

- 1분마다 `private.invoke_deletion_worker()`를 실행한다.
- 함수는 Vault에서 프로젝트 URL, Publishable key, worker 전용 비밀값을 읽는다.
- `Authorization: Bearer <worker secret>`은 Edge Function 내부의 추가 인증에 사용한다.
- Publishable key는 Edge Function gateway 요청에만 사용하며, Service Role key를 DB·브라우저에 저장하지 않는다.

## 완료 기준

- migration이 `pg_net`, `pg_cron`, 내부 호출 함수, Cron job을 생성한다.
- anon과 authenticated role은 내부 호출 함수를 실행할 수 없다.
- pgTAP이 extension·함수·권한·Cron 주기를 검증한다.
- Vault 생성, migration 배포, 실행 기록·운영 상태 확인 절차가 문서화된다.
