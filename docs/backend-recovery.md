# 백엔드 백업·복구 Runbook

## 목적과 기준

이 문서는 Talk후감 Phase 1의 Supabase PostgreSQL, Auth 설정, Storage 아바타,
Edge Functions 설정과 Mux 영상 메타데이터를 복구하기 위한 절차다.

- 초기 운영 목표 RPO: 최대 24시간의 데이터 손실
- 초기 운영 목표 RTO: 장애 확인 후 4시간 안에 핵심 읽기·쓰기 복구
- 운영 플랜과 트래픽이 확정되면 PITR 필요 여부와 목표를 다시 승인한다.
- 원격 운영 DB에는 `supabase db reset`을 실행하지 않는다.
- 복구는 항상 새 격리 프로젝트에서 검증한 후 전환한다.

## 백업 범위

| 대상 | 백업 방법 | 주의사항 |
| --- | --- | --- |
| PostgreSQL 역할·스키마·데이터 | Supabase 관리형 백업과 CLI 논리 백업 | 운영 플랜의 백업 보존 기간을 별도로 확인한다. |
| Auth 사용자 | PostgreSQL 데이터 백업에 포함 | OAuth 공급자 설정, redirect URL, API key는 별도 설정 목록이 필요하다. |
| Storage `avatars` 객체 | Storage API로 객체와 경로 manifest를 별도 복제 | DB 백업에는 `storage.objects` 메타데이터만 있고 실제 파일은 없다. |
| Mux 영상 | Mux가 원본과 변환 영상을 보관 | DB에는 Mux asset/playback ID와 상태만 보관한다. Mux 자산 자체는 Supabase 백업 대상이 아니다. |
| Edge Functions | Git의 함수 소스와 배포 이력 | 시크릿 값은 Git이나 백업 문서에 저장하지 않는다. |
| 시크릿·외부 서비스 설정 | 비밀 관리자와 운영 설정 checklist | 값이 아니라 key 이름, 담당자, 마지막 회전 시각만 기록한다. |

책방 삭제가 확정되면 연결된 메시지, 독후감, 영상 메타데이터를 삭제하고 Mux 삭제
작업을 큐에 넣는다. 따라서 삭제가 완료된 책방과 Mux 영상은 정기 백업에서 영구 보존하지
않는다. 법적·운영 보존 기간이 생기면 이 정책을 먼저 변경한다.

## 백업 생성

### 1. 사전 확인

1. 운영 프로젝트 ref, PostgreSQL major version, Supabase CLI 버전을 기록한다.
2. 배포된 Git commit과 migration 목록을 기록한다.
3. Auth 공급자, redirect URL, Storage bucket, Realtime, extension 목록을 내보낸다.
4. 백업 파일은 암호화된 저장소에 만들고 Git 작업 폴더 밖으로 이동한다.

### 2. PostgreSQL 논리 백업

비밀번호를 명령행에 직접 쓰지 말고 비밀 관리자에서 일시적으로 주입한다.

```bash
mkdir -p backups/YYYY-MM-DD

supabase db dump --db-url "$SOURCE_DATABASE_URL" \
  --file backups/YYYY-MM-DD/roles.sql \
  --role-only

supabase db dump --db-url "$SOURCE_DATABASE_URL" \
  --file backups/YYYY-MM-DD/schema.sql

supabase db dump --db-url "$SOURCE_DATABASE_URL" \
  --file backups/YYYY-MM-DD/data.sql \
  --use-copy \
  --data-only
```

각 파일이 비어 있지 않은지 확인하고 SHA-256 checksum, 생성 시각, source project ref를
별도 manifest에 기록한다. SQL 파일이나 manifest에는 접속 URL과 시크릿을 기록하지 않는다.

### 3. Storage와 외부 설정

1. `avatars` bucket의 객체 경로, 크기, content type, checksum manifest를 만든다.
2. 객체를 접근 제한된 별도 object storage에 복제한다.
3. Auth 공급자(Kakao, Google, 추후 Naver bridge), redirect URL과 활성화 여부를 기록한다.
4. Edge Function 시크릿 key 목록과 Mux webhook URL을 기록한다.
5. Mux asset은 별도 복사하지 않되, DB의 asset ID 표본이 Mux에서 조회되는지 점검한다.

## 격리 프로젝트 복구

### 1. 복구 대상 준비

1. 운영과 분리된 새 Supabase 프로젝트를 같은 PostgreSQL major version으로 만든다.
2. 운영 트래픽과 webhook이 들어오지 않게 외부 URL과 시크릿을 연결하지 않는다.
3. Git의 기록된 commit을 checkout하고 필요한 extension을 먼저 활성화한다.
4. 기본 역할의 과도한 권한 상속을 막기 위해 Supabase 공식 restore 안내의 권한 설정을 적용한다.

### 2. 데이터베이스 복구

```bash
psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file backups/YYYY-MM-DD/roles.sql \
  --file backups/YYYY-MM-DD/schema.sql \
  --command 'SET session_replication_role = replica' \
  --file backups/YYYY-MM-DD/data.sql \
  --dbname "$TARGET_DATABASE_URL"
```

명령이 실패하면 동일 대상에 이어서 실행하지 않는다. 프로젝트를 폐기하고 실패 원인을
수정한 뒤 새 격리 프로젝트에서 처음부터 다시 수행한다.

### 3. 설정과 파일 복구

1. Auth 공급자와 redirect URL을 운영 checklist에서 다시 설정한다.
2. `avatars` bucket 정책을 migration과 비교한 뒤 객체를 복원한다.
3. Edge Functions를 기록된 commit에서 배포하고 새 프로젝트의 시크릿을 주입한다.
4. Realtime table 설정, extension, scheduled worker와 Mux webhook을 다시 연결한다. 삭제 worker는
   [삭제 worker 운영 스케줄](./deletion-worker-schedule.md)의 Vault 설정을 먼저 복원한 뒤 Cron job을 활성화한다.
5. Mux 삭제 worker는 DB 검증 완료 전까지 실행하지 않는다.

## 복구 검증

다음 항목이 모두 통과해야 복구 성공으로 판정한다.

- roles, schema, data restore 명령이 오류 없이 완료됨
- migration 이력과 배포 commit이 백업 manifest와 일치함
- `pnpm backend:lint` 통과
- `pnpm backend:test:db`의 schema, RLS, RPC, 삭제 정책 계약 통과
- 핵심 테이블별 row count와 관계 무결성 표본 일치
- anon 사용자의 private table 직접 조회 차단
- 인증 사용자의 본인 데이터 접근과 타인 데이터 차단
- 방장, 멤버, 탈퇴 사용자 권한 표본 일치
- Storage 비공개 객체의 본인 접근과 타인 접근 차단
- Mux asset ID 표본 조회와 signed playback token 발급 성공
- 로그에 email, token, 본문, 업로드 URL이 남지 않음

## 계정 삭제 완료 기록 복구

`backend_operational_health()`의 `accountDeletionCompletionPending`이 0보다 크면, 완료 기록을
확정하지 못한 요청이 5분 이상 남아 있을 수 있다. Auth 삭제 성공 여부는 이 수치만으로 판단하지 않고,
다음 절차로 확인한다.

1. Supabase Dashboard의 SQL Editor에서 운영 프로젝트의 권한 있는 운영자만 대상 요청의 `profile_id`가
   `auth.users`에 더 이상 없는지 확인한다. 이 확인 전에는 완료 처리하지 않는다.
   Dashboard 왼쪽 메뉴에서 **SQL Editor → New query**를 연 뒤, 아래 SQL의 UUID만 대상 값으로 바꿔 실행한다.
   ```sql
   select request_id, profile_id
   from private.account_deletion_requests
   where status = 'prepared'
     and updated_at < now() - interval '5 minutes';

   select id
   from auth.users
   where id = '<위에서 확인한 profile_id>'::uuid;
   ```
2. 두 번째 조회가 행을 반환하지 않은 경우에만, 같은 SQL Editor에서 아래 SQL의 UUID를 대상 `request_id`로
   바꿔 실행한다.
   ```sql
   select public.finish_account_deletion(
     '<대상 request_id>'::uuid,
     true,
     null
   );
   ```
3. `backend_operational_health()`을 다시 실행해 `accountDeletionCompletionPending`이 감소했는지 확인한다.
4. 복구 시각, request ID, 확인 결과는 접근 제한된 운영 기록에만 남긴다. 사용자 이메일이나 토큰은 기록하지 않는다.

## 복구 훈련 기록

실제 운영 연결 전과 이후 분기마다 최소 한 번 격리 복구를 수행한다.

| 항목 | 기록값 |
| --- | --- |
| 훈련 일시 |  |
| 담당자 |  |
| source project ref |  |
| target project ref |  |
| Git commit |  |
| 백업 생성 시각 |  |
| 복구 완료 시각 |  |
| 측정 RPO / RTO |  |
| DB·RLS 테스트 결과 |  |
| Storage 검증 결과 |  |
| Mux 검증 결과 |  |
| 발견 이슈와 후속 티켓 |  |

## 공식 참고 문서

- [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups)
- [Restore a platform backup](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Supabase CLI db dump](https://supabase.com/docs/reference/cli/v0/supabase-db-dump)
