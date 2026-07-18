---
type: Architecture Overview
title: Talk후감 아키텍처
description: React SPA와 Supabase 기반 Talk후감의 화면 계층, 라우팅·인증 경계, 서버 상태, 외부 서비스 연동 방식을 설명한다.
resource: /apps/web/src/app/router/router.tsx
tags: [talkhugam, architecture, react, supabase]
---

# 아키텍처

Talk후감은 `apps/web`의 React/Vite 단일 페이지 앱과 저장소 루트 `supabase`의 PostgreSQL·Auth·Realtime·Edge Function으로 구성된다. Vercel은 `apps/web/dist`를 배포하고 모든 경로를 SPA 진입 HTML로 rewrite한다(`vercel.json`). 웹 패키지의 build는 TypeScript 프로젝트 검사 후 Vite build를 수행한다([`apps/web/package.json`](../apps/web/package.json)).

## 클라이언트 계층

[`AGENTS.md`](../AGENTS.md)는 다음 책임 분리를 요구한다.

- `pages`: 경로 단위 화면과 조립.
- `features`: 인증, 피드백, 영상 업로드처럼 사용자 행동을 재사용 가능한 단위로 구현.
- `entities`: 도메인별 Supabase 접근, Zod 검증, snake_case DB 행에서 camelCase 모델로의 변환, TanStack Query key를 소유.
- `shared`: Supabase client, 공용 UI, 분석, 스타일 같은 기반.

이 계층은 [제품 흐름](./product-flows.md)의 화면 여정을 구현하고, 데이터 접근·권한 판단은 [보안과 운영](./security-operations.md)의 서버 경계에 맡긴다. Supabase raw Row는 UI까지 전달하지 않고 entity의 repository/mapper에서 도메인 모델로 변환해야 한다.

## 앱 진입과 상태

[`apps/web/src/main.tsx`](../apps/web/src/main.tsx)는 `#root`에 `StrictMode`의 앱을 mount한다. [`apps/web/src/app/App.tsx`](../apps/web/src/app/App.tsx)는 `AppProviders`와 Router를 결합한다.

[`AppProviders.tsx`](../apps/web/src/app/providers/AppProviders.tsx)는 전역 TanStack Query client를 제공하며 기본적으로 query를 두 번 재시도하고, 30초 stale time·10분 GC time을 사용한다. 서버 상태는 이 경계에서 관리하며 session이나 서버 데이터를 Zustand에 복제하지 않는 것이 저장소 규칙이다.

브라우저 환경값은 [`apps/web/src/app/env.ts`](../apps/web/src/app/env.ts)의 Zod schema가 한 번 검증한다. 필수 항목은 Supabase URL과 publishable key이고, 분석 ID와 지원 이메일은 선택이다. 다른 클라이언트 모듈에서 `import.meta.env`를 직접 읽지 않는다.

## 라우팅과 접근 제어

[`router.tsx`](../apps/web/src/app/router/router.tsx)는 `createBrowserRouter` 기반의 계층 라우터다.

1. 최외곽 `AnalyticsLayout`은 공개·보호 경로를 함께 감싸 분석 이벤트를 붙인다.
2. 공개 경로는 로그인 `/`, OAuth callback `/auth/callback`, 법적 문서 `/legal/:documentId`, 문의 `/contact`다.
3. `AuthenticatedRoute`는 인증 사용자를 확인한다. 인증이 필요한 모든 화면은 이 guard 안에 있다.
4. `ConsentRequiredRoute`는 필수 약관 동의 여부를 확인하고, 미동의 사용자를 `/legal-consent`로 보낸다.
5. `AppNavigationLayout`은 동의된 사용자의 앱 내 화면을 조립하며, 앱 내 피드백 시작점과 하단 내비게이션을 제공한다.
6. `AdminRoute`는 일반 앱 내비게이션과 별도로 `/admin` 접근을 보호한다.

책방 관련 화면은 기술 경로 `/rooms` 아래에 정의되지만, 사용자에게 보이는 개념은 책방이다. `/rooms/:roomId/books/:bookChatId`는 책 대화 상세이고, 영상 archive/player route만 lazy load한다. 라우팅이 어떤 사용자 여정을 수용하는지는 [제품 흐름](./product-flows.md)을 기준으로 본다.

## 서버와 외부 통합

클라이언트의 `shared/api/supabaseClient.ts`는 Supabase JavaScript client를 제공한다. entity는 PostgREST 읽기, RPC, Edge Function 호출을 이 클라이언트 경계로 모은다.

- **Supabase Auth/PostgreSQL/Realtime**: 사용자 인증, 관계·콘텐츠 저장, RLS 기반 조회/수정 경계. 로컬 설정은 [`supabase/config.toml`](../supabase/config.toml)에 있다.
- **Edge Functions**: 책 검색(`book-search`), Naver OAuth 시작, 피드백 제출·관리, 계정 삭제, Mux 업로드·webhook·재생 토큰·삭제 worker처럼 외부 API나 특권 작업을 처리한다. `verify_jwt = false`인 함수도 함수 내부의 인증·서명·worker 비밀값 검증에 의존하므로, 그 구현 규칙은 [보안과 운영](./security-operations.md)을 따른다.
- **Mux**: 브라우저는 Edge Function이 발급한 업로드 URL로 파일을 전송하고, 재생·썸네일은 인가된 토큰 경계를 거친다. 앱의 영상은 최대 30초라는 제품 제한이 있다(`README.md`, `features/video-upload`).
- **분석**: `AnalyticsLayout`과 `shared/analytics`가 선택적으로 GA4와 Clarity를 로드한다. GA4는 경로와 정의된 이벤트만 전송하도록 구현되어 있다.

## 변경 가이드

- 새 화면은 먼저 route guard·내비게이션 영향과 320px/최대 640px 캔버스 제약을 검토한다.
- 새 데이터 모델은 entity에 schema/mapper/query key를 두고, UI가 raw Row나 비검증 외부 입력을 받지 않게 한다.
- 외부 API, webhook, service-role 권한은 브라우저가 아닌 Edge Function 또는 PostgreSQL 함수에 둔다. 이는 [보안과 운영](./security-operations.md)의 권한 모델을 보존한다.
- 라우트·인증·데이터 경계 변경은 [테스트](./testing.md)의 컴포넌트, pgTAP, Deno, Playwright 범위를 함께 갱신한다.