# 앱 내 알림함 구현 계획

> **에이전트 작업 필수 절차:** `subagent-driven-development` 방식으로 테스트를 먼저 작성하고 명세·품질 검토를 거친다.

**목표:** 답글·멘션 등 개인 알림을 확인하고 읽음 처리한 뒤 관련 독서방 또는 책 대화로 이동한다.

**구조:** `entities/notification`이 Supabase nested row를 Zod로 검증해 UI용 도메인 모델과 이동 경로로 매핑한다. `/rooms`의 알림 CTA와 `/notifications` 페이지는 TanStack Query로 목록·미읽음 수·읽음 RPC를 관리한다.

**기술:** React, TypeScript strict, TanStack Query, Zod, Supabase, Vitest, Playwright

---

### 작업 1: 알림 도메인 모델

**파일:**
- 생성: `apps/web/src/entities/notification/notification.ts`
- 생성: `apps/web/src/entities/notification/notification.test.ts`
- 생성: `apps/web/src/entities/notification/index.ts`

- [ ] Zod mapper 테스트를 먼저 작성한다: mention/reply, null actor fallback, post의 bookChatId deep link, unread count, 단일/전체 읽음 RPC payload.
- [ ] `getNotifications`, `getUnreadNotificationCount`, `markNotificationsRead`, `parseNotifications`를 구현한다. 모든 raw row는 mapper에서 camelCase 도메인 모델로 바꾼다.
- [ ] 단위 테스트를 실행한다: `pnpm --filter web test -- notification.test.ts`.

### 작업 2: 알림함 화면과 진입 CTA

**파일:**
- 생성: `apps/web/src/pages/notifications/NotificationsPage.tsx`
- 생성: `apps/web/src/pages/notifications/NotificationsPage.test.tsx`
- 수정: `apps/web/src/app/router/router.tsx`
- 수정: `apps/web/src/pages/rooms/RoomsPage.tsx`
- 수정: `apps/web/src/pages/rooms/RoomsPage.test.tsx`

- [ ] 실패하는 RTL 테스트를 작성한다: 알림 CTA의 unread accessible name, 로딩/빈/오류·재시도, 행 클릭의 읽음 처리·이동, 모두 읽음 cursor, 오류 시 이동 방지.
- [ ] `/rooms` 헤더의 44px 알림 CTA와 `/notifications` route를 구현한다.
- [ ] 알림 화면은 `AppHeader`, `LoadingSpinner`, 320px token spacing을 사용한다. 알림 행은 한 개의 button이며 `min-w-0`/시각 shrink, 44px 이상을 보장한다.
- [ ] 성공적인 읽음 처리 뒤에만 이동·query invalidation을 수행한다.

### 작업 3: 검토와 검증

- [ ] 명세 검토: 읽음 cursor, null fallback, route 규칙, 접근성을 확인한다.
- [ ] 품질 검토: Zod/UI boundary, JSDoc, TS, raw row, keyboard·320px을 확인한다.
- [ ] 전체 검증: format, lint, typecheck, JSDoc, Vitest, build, Playwright.
- [ ] Figma에 Header Icon, unread badge, Notification Row, screen states를 동기화한다.
