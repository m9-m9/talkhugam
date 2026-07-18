---
type: Testing Guide
title: Talk후감 테스트 전략
description: Talk후감의 웹·데이터베이스·Edge Function·격리 통합 테스트와 변경 유형별 검증 명령을 안내한다.
resource: /package.json
tags: [talkhugam, testing, ci, playwright, pgtap]
---

# 테스트 전략

Talk후감에서 테스트는 사용자가 대신 수행할 절차가 아니라 변경을 구현한 사람이 완료 전에 실행하는 책임이다. [`AGENTS.md`](../AGENTS.md)는 순수 로직에 Vitest, React 화면 상태·상호작용에 Testing Library, 핵심 브라우저 흐름에 Playwright, Edge Function에 Deno test, DB 권한·RPC에 pgTAP을 우선하도록 정한다.

[제품 흐름](./product-flows.md)의 화면 변경과 [보안과 운영](./security-operations.md)의 권한 변경은 서로 다른 계층의 검증을 함께 요구할 수 있다.

## 웹 검증

루트 명령은 웹 workspace의 scripts를 위임한다.

```bash
pnpm format:web
pnpm docs:functions:web
pnpm lint:web
pnpm typecheck:web
pnpm test:web
pnpm build:web
pnpm test:e2e:web
```

- `format:web`, `lint:web`, `typecheck:web`: 스타일·정적 규칙·strict TypeScript 경계를 확인한다.
- `docs:functions:web`: 함수와 컴포넌트의 책임 JSDoc 규칙을 검사한다.
- `test:web`: Vitest와 Testing Library로 schema, mapper, query key, 화면 상태, 상호작용을 확인한다.
- `build:web`: `tsc -b && vite build`로 production build 가능 여부를 확인한다.
- `test:e2e:web`: Playwright Chromium에서 UI를 검사한다. README 기준으로 320px와 640px, 캔버스 폭·가로 넘침, 책 대화 추가 메뉴, axe-core 접근성 검사를 포함한다.

라우트·guard·분기 변경은 [`apps/web/src/app/router`](../apps/web/src/app/router)와 대상 페이지의 테스트를, 책 대화·독후감 변경은 해당 entity/feature와 페이지 테스트를 함께 갱신한다. 화면 테스트만으로 권한을 증명할 수 없으므로 권한 규칙 변경은 DB 검증도 추가한다.

## 데이터베이스 계약

`supabase/tests/database/*.test.sql`은 pgTAP으로 schema, 제약조건, RLS, RPC를 확인한다. 각 테스트는 `begin`/`rollback`으로 격리하며 실제 사용자 이메일·토큰·운영 데이터를 사용하지 않는다([`supabase/tests/README.md`](../supabase/tests/README.md)).

```bash
pnpm backend:start
pnpm backend:reset
pnpm backend:lint
pnpm backend:test:db
pnpm backend:stop
```

RLS 또는 RPC를 바꾸면 허용 케이스와 거부 케이스를 모두 작성한다. 특히 공개 테이블의 anon 차단, 본인 데이터 접근, 타인 데이터 차단, 활성 멤버십, 소유자 전용 관리, service-role 전용 함수의 권한을 검증한다. 이 계약은 [보안과 운영](./security-operations.md)의 서버 경계를 회귀로부터 보호한다.

## Edge Function과 격리 통합

```bash
pnpm backend:check:functions
pnpm backend:test:functions
pnpm backend:check:integration
pnpm backend:test:integration
```

- Deno 정적 검사·함수 테스트는 request schema, CORS, 사용자 인증, OAuth state, Mux webhook 서명, worker 비밀값 같은 함수 경계를 다룬다.
- 통합 테스트는 실제 Auth·RLS·RPC·Edge Function 흐름을 테스트 전용 Supabase 프로젝트에서 수행한다. 운영 프로젝트를 대상으로 실행하지 않으며 GitHub Actions workflow도 수동 dispatch와 별도 `integration` environment를 사용한다(`docs/integration-test.md`, `.github/workflows/integration-tests.yml`).
- `pnpm backend:test:mux`는 비용·외부 상태 의존성이 있는 실제 Mux 흐름용 분리 명령이다. 모든 PR에서 자동 실행된다고 가정하지 않는다.

## CI와 변경 매트릭스

프론트엔드 CI([`frontend-ci.yml`](../.github/workflows/frontend-ci.yml))는 install 후 format, 함수 문서 검사, lint, typecheck, unit/component test, build, Chromium Playwright를 수행한다. 백엔드 CI([`backend-ci.yml`](../.github/workflows/backend-ci.yml))는 보안·origin·통합 구성 검사, Deno 검사/테스트, 로컬 Supabase migration·lint·pgTAP, 전체 Git 이력의 gitleaks를 수행한다.

| 변경 유형 | 최소 확인 | 추가 확인 |
| --- | --- | --- |
| 순수 mapper, schema, query key | `pnpm test:web`, typecheck | 영향 entity의 경계 테스트 |
| 화면·상호작용·라우트 | web unit/component, lint, typecheck, build | 해당 Playwright 시나리오와 320px 상태 |
| 책방·책 대화·독후감 사용자 흐름 | 대상 page/feature/entity 테스트 | E2E 핵심 시나리오 |
| migration, RLS, RPC | backend start/reset/lint/db test | 호출하는 UI/edge 함수 테스트 |
| Edge Function, webhook, CORS | check/functions test | 격리 통합, 외부 플랫폼은 수동 smoke 범위 기록 |
| 삭제, 계정, Mux 운영 경계 | DB 계약과 Deno boundary test | health·queue·worker runbook 점검 |

## 완료 기준

변경 범위에 맞는 lint, typecheck, test, build를 실행하고 결과를 보고한다. 실제 외부 플랫폼 secret, OAuth 설정, 배포 환경처럼 자동화가 부적절한 범위는 staging 또는 수동 smoke test로 검증하되, 실행하지 못한 범위와 이유를 명확히 남긴다. `skip`, 과도한 timeout, 의미 없는 mock으로 통과를 만들지 않는다.

테스트는 [아키텍처](./architecture.md)의 계층을 존중한다. UI는 검증된 도메인 모델을 다루고, 권한의 최종 증명은 [보안과 운영](./security-operations.md)의 DB·함수 계약 테스트에서 수행한다.