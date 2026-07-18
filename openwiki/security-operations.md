---
type: Security and Operations Guide
title: Talk후감 보안과 운영
description: Talk후감의 RLS·RPC·Edge Function 권한 경계, 비동기 삭제, 백업·복구와 운영 시 주의사항을 설명한다.
resource: /supabase/migrations
tags: [talkhugam, security, operations, supabase]
---

# 보안과 운영

Talk후감은 클라이언트의 화면 조건을 최종 권한 판단으로 쓰지 않는다. 공개 스키마 테이블은 RLS를 사용하고, 상태 변경은 좁은 PostgreSQL RPC 또는 Edge Function 경계에서 검증한다. 이 원칙은 [`AGENTS.md`](../AGENTS.md)와 [`supabase/tests/database/130_rls_audit.test.sql`](../supabase/tests/database/130_rls_audit.test.sql)의 계약 테스트에 명시되어 있다.

## 데이터 접근과 RPC

- `anon`에 공개 테이블 직접 권한을 주지 않고, 인증 사용자의 직접 INSERT/DELETE도 제한한다.
- 프로필·알림 설정은 본인 기준, 책방·책 대화·게시물·영상은 활성 멤버십 기준으로 조회·수정 범위를 제한한다.
- 변경에 쓰는 `SECURITY DEFINER` 함수는 고정 `search_path`를 사용하며, 호출 사용자·활성 멤버십·아카이브 상태·입력 제약을 서버에서 확인한다.
- 권한이 필요한 함수는 `public`/`anon` 실행 권한을 철회하고 필요한 역할에만 execute를 부여한다.

예를 들어 [`20260718000500_add_room_management.sql`](../supabase/migrations/20260718000500_add_room_management.sql)의 `remove_room_member`는 호출자가 활성 소유자인지 확인하고, 본인이나 다른 소유자의 제거를 거부한 뒤 대상 멤버십을 `removed`로 기록한다. 이 제약은 [제품 흐름](./product-flows.md)의 관리 화면이 의존하는 실제 권한 계약이다.

모든 스키마·인덱스·함수·trigger·RLS 변경은 Dashboard 수동 수정 대신 migration으로 기록한다. 생성된 `supabase/types/database.types.ts`는 직접 편집하지 않는다.

## Edge Function과 외부 경계

`supabase/config.toml`에서 여러 Edge Function은 플랫폼 JWT 검증을 끈 상태(`verify_jwt = false`)다. 이는 공개 접근을 뜻하지 않는다. 함수 내부에서 각 목적에 맞게 다음을 확인해야 한다.

- 사용자 요청: Bearer token을 `auth.getUser()`로 확인하고 멤버십/RPC 규칙을 적용.
- 관리자 작업: 서버 전용 클라이언트와 관리자 allowlist로 확인.
- Mux webhook: HMAC 서명 확인 후 service-role RPC 호출.
- 삭제 worker: worker 전용 Authorization 값을 상수시간 비교.
- CORS: 허용 origin의 정확 일치; 와일드카드 금지.

서비스 역할 키, OAuth 비밀값, Mux 비밀값·서명 키는 브라우저·Git·로그·분석 이벤트에 노출하지 않는다. 개인정보, 책 대화 본문, 초대 코드, 토큰, 영상 URL도 로그나 분석 이벤트에 기록하지 않는다. 클라이언트와 Edge Function의 역할 분리는 [아키텍처](./architecture.md)의 외부 통합 경계를 보완한다.

## 삭제와 운영 health

책방·영상·계정 삭제는 먼저 DB에서 숨기거나 삭제·비식별화하고, Mux 자산의 물리 삭제는 대기열 기반 `deletion-worker`가 처리한다. queue claim은 잠금을 사용하며 실패하면 backoff 후 재시도하고, 최대 재시도 초과 시 실패 상태로 남긴다.

[`docs/deletion-worker-schedule.md`](../docs/deletion-worker-schedule.md)에 따르면 `pg_cron`은 매분 `private.invoke_deletion_worker()`를 실행하고, `pg_net`이 worker를 비동기 호출한다. 프로젝트 URL·publishable key·worker 전용 비밀값은 Vault에 보관한다. worker 상태는 `public.backend_operational_health()`의 집계로 확인한다. 긴급 중지는 Cron job을 비활성화하고, 재개 후 실행 기록과 deletion due/failed 지표를 함께 확인한다.

계정 삭제 완료 기록이 보류되면 health 지표만으로 Auth 삭제 성공을 단정하지 않는다. [`docs/backend-recovery.md`](../docs/backend-recovery.md)의 절차처럼 권한 있는 운영자가 Auth 사용자 부재를 확인한 뒤에만 완료 RPC를 호출한다.

## 백업과 복구

운영 목표는 초기 RPO 24시간, RTO 4시간이며 실제 운영 플랜에 따라 다시 승인해야 한다. 원격 운영 DB에서 `supabase db reset`을 실행하지 않고, 항상 새 격리 프로젝트에서 복구를 검증한 뒤 전환한다.

백업 범위는 PostgreSQL·Auth 데이터, 비공개 `avatars` Storage 객체의 별도 복제, Edge Function 소스·배포 이력, Mux asset/playback ID 메타데이터다. Storage 실제 객체와 Mux 자산은 DB 논리 백업만으로 복원되지 않는다. 시크릿은 값이 아니라 key 이름·담당·회전 시각만 제한된 운영 기록에 남긴다.

복구 성공 판단에는 migration 이력 일치, `pnpm backend:lint`, pgTAP 계약, anon 차단과 본인/타인 접근 표본, Storage 접근, Mux token 발급, 민감정보가 없는 로그 확인이 포함된다. 이 검증의 구체적인 명령과 CI 대응은 [테스트](./testing.md)를 따른다.

## 변경과 장애 대응 체크

1. 권한·데이터 모델 변경 전 migration, 기존 RLS/RPC 테스트, 호출하는 entity·화면을 함께 찾는다.
2. 새 특권 작업은 Edge Function 또는 PostgreSQL 함수에 두고, browser에 service role/secret을 추가하지 않는다.
3. 삭제 흐름을 바꾸면 큐, worker, health, Cron runbook, 실패·재시도 테스트를 한 묶음으로 수정한다.
4. 배포·복구 작업은 실제 비밀값을 채팅·커밋·스크린샷에 남기지 않고, 비개발자 안내가 필요하면 Dashboard 경로·필드명·확인 방법만 제공한다.

[제품 흐름](./product-flows.md)은 어떤 사용자가 어떤 행동을 하는지, 이 문서는 그 행동이 서버에서 허용되는 조건과 운영상 결과를 설명한다.