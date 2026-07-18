---
type: Repository Guide
title: Talk후감 빠른 시작
description: Talk후감의 서비스 범위, 개발 시작 명령, 사용자 용어, 핵심 기술 문서를 안내하는 저장소 진입점이다.
resource: /README.md
tags: [talkhugam, onboarding, frontend, supabase]
---

# Talk후감 빠른 시작

Talk후감은 가까운 사람들과 비공개 **책방**에서 책에 관한 대화, **독후감**, 짧은 독서 순간 영상을 함께 기록하는 모바일 우선 웹 서비스다. Phase 1은 책방당 최대 6명, 책별 대화와 답글·멘션·앱 내 알림, 개인 완독 기록, 30초 영상, Kakao·Naver·Google 로그인을 범위로 둔다. 근거는 [`README.md`](../README.md)와 화면 라우트 정의인 [`apps/web/src/app/router/router.tsx`](../apps/web/src/app/router/router.tsx)다.

## 먼저 알아둘 용어

- 제품과 화면에서는 **책방**, **책 대화**, **독후감**을 사용한다.
- `reading_rooms`와 `/rooms`는 기존 데이터베이스·라우팅의 **기술 식별자**다. 제품 명칭이나 화면 문구로 해석하지 않는다.
- 기능을 바꿀 때는 [`AGENTS.md`](../AGENTS.md)의 아키텍처·보안·UI·검증 규칙이 최우선이다. 특히 공개 테이블의 RLS, migration 기록, 환경변수 검증 경계, 320px UI 검증, 변경 성격에 맞는 자동 테스트가 필수다.

## 저장소 지도

| 위치 | 책임 | 시작 파일 |
| --- | --- | --- |
| `apps/web` | React/Vite 클라이언트 | `src/main.tsx`, `src/app/router/router.tsx` |
| `apps/web/src/pages` | 경로 단위 화면 조립 | `pages/rooms`, `pages/profile`, `pages/legal` |
| `apps/web/src/features` | 인증·피드백·업로드처럼 재사용되는 사용자 행동 | `features/auth`, `features/video-upload` |
| `apps/web/src/entities` | Supabase 호출, Zod 검증, DB 행→도메인 모델 변환, Query key | `entities/reading-room`, `book-chat`, `book-completion` |
| `supabase/migrations` | 스키마, RPC, RLS, worker 스케줄의 변경 이력 | `20260718000500_add_room_management.sql` 등 |
| `supabase/functions` | 외부 API, webhook, 관리자·삭제 등 서버 경계 | `_shared`, `mux-*`, `account-delete`, `feedback-*` |
| `supabase/tests` | pgTAP 스키마·RLS·RPC 계약 | `tests/README.md` |
| `docs` | 인증, 법적 출시, 복구, 삭제 worker, 통합 테스트 runbook | `backend-recovery.md`, `integration-test.md` |

## 로컬 실행

Node 22와 pnpm 10을 사용한다(`package.json`). 의존성 설치 후 웹 앱을 실행한다.

```bash
pnpm install
pnpm dev:web
```

브라우저 주소는 `http://localhost:5173`이며, 웹 앱은 `apps/web`에 있다. 백엔드 로컬 환경이 필요한 변경은 다음 순서로 준비한다.

```bash
pnpm backend:start
pnpm backend:reset
pnpm backend:test:db
```

환경값은 예시 파일을 기준으로 설정하되 실제 값이나 비밀값을 커밋·로그·문서에 남기지 않는다. 브라우저 공개 환경값은 [`apps/web/src/app/env.ts`](../apps/web/src/app/env.ts)에서 검증한다.

## 핵심 문서

- [아키텍처](./architecture.md): SPA 계층, 인증 guard, 서버 상태, Supabase·Mux 경계.
- [제품 흐름](./product-flows.md): 로그인부터 책방, 책 대화, 독후감, 관리·피드백까지의 사용자 여정.
- [보안과 운영](./security-operations.md): RLS/RPC/Edge Function 경계, 삭제 worker, 복구 원칙.
- [테스트](./testing.md): 변경 유형별 명령, pgTAP·Deno·UI·브라우저 검증, CI와 통합 테스트 범위.

## 변경 시 출발점

1. 화면·여정 변경은 [제품 흐름](./product-flows.md)에서 해당 흐름과 경로를 확인하고, `pages`가 `features`·`entities`를 조합하는 기존 경계를 유지한다.
2. 데이터·권한·외부 연동 변경은 [보안과 운영](./security-operations.md)을 먼저 읽는다. 클라이언트 편의 때문에 RLS나 RPC 검증을 우회하지 않는다.
3. 구현 전후에는 [테스트](./testing.md)의 변경-검증 매트릭스로 필요한 자동 검증을 실행한다.

## Backlog

- 실운영 배포 구성: `vercel.json`, Supabase Dashboard, 외부 제공자 설정에 걸쳐 있고 비밀값·대시보드 상태를 읽지 않았으므로, 배포 변경 시 별도 운영 문서 업데이트가 필요하다.
- Realtime 구독 상세: [`supabase/config.toml`](../supabase/config.toml)은 Realtime 활성화만 보여 주며, 실제 구독 채널·재연결 동작의 전면 조사는 이번 첫 문서화 범위에서 보류했다.