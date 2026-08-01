# 책방 경험과 권한 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 책방의 독서 상태, 역할 권한, 메시지 추가, 책방 전체 영상 기록을 일관된 UX와 서버 권한으로 제공한다.

**Architecture:** `room_members.role`을 방장·운영자·참여자로 확장하고, DB RPC가 초대·책 관리·구성원 관리를 최종 검증한다. 웹은 공통 독서 상태 표현을 재사용하고 `방 정보`를 역할별 운영 허브로 전환한다. 영상은 기존 책 대화별 보관함을 유지하면서 책방 단위 집계 라우트를 추가한다.

**Tech Stack:** React, TypeScript strict, TanStack Query, `@seed-design/react`, Supabase PostgreSQL RPC/RLS, Vitest, React Testing Library, Playwright, pgTAP.

## Global Constraints

- 320px 최소 폭과 최대 640px 중앙 캔버스를 유지한다.
- 방장만 역할 변경·멤버 내보내기·방장 이양·방 설정을 수행한다.
- 운영자는 초대·책 추가·요청 승인을 수행하고 참여자는 초대 요청·책 제안만 수행한다.
- `+`에는 라벨 등록과 현재 책의 영상 기록만 남긴다.
- 모든 함수와 컴포넌트 바로 위에 책임을 설명하는 한글 JSDoc을 둔다.
- 완료 전에 `pnpm test:web`, `pnpm build:web`, `pnpm --filter @talkhugam/web test:e2e`를 실행한다.

---

### Task 1: 역할과 요청 서버 계약

**Files:**
- Create: `supabase/migrations/20260802000100_add_room_manager_roles.sql`
- Create: `supabase/tests/database/140_room_roles_and_requests.test.sql`
- Modify: `supabase/migrations/20260716000800_create_invite_rpcs.sql`
- Modify: `supabase/migrations/20260716001100_secure_books_and_chats.sql`

**Interfaces:**
- Produces `manager` member role, `create_room_book_request`, `list_room_requests`, `resolve_room_request`, `update_room_member_role` RPCs.
- Consumes active room membership and existing `create_book_chat` input contract.

- [ ] Write pgTAP cases that prove owner/manager can invite and create books, members cannot, members can submit requests, and only owners can change roles.
- [ ] Run the pgTAP file and confirm the new cases fail before the migration is applied.
- [ ] Add the migration: extend `member_role`, create requests with pending/approved/rejected state, and security-definer RPCs that check current role and active membership.
- [ ] Change invite and book creation role guards to call one shared `private.can_manage_room_content(room_id)` helper.
- [ ] Re-run the pgTAP file and confirm allowed and denied cases pass.

### Task 2: 역할·요청 도메인 모델

**Files:**
- Create: `apps/web/src/entities/room-permission/roomPermission.ts`
- Create: `apps/web/src/entities/room-permission/roomPermission.test.ts`
- Modify: `apps/web/src/entities/room-management/roomManagement.ts`
- Modify: `apps/web/src/entities/room-management/index.ts`

**Interfaces:**
- Produces `RoomRole`, `canManageRoomContent`, `canManageRoomMembers`, `RoomRequest` and typed RPC adapters.
- Consumes validated room member rows and request rows.

- [ ] Write failing unit tests for each role capability and request mapping.
- [ ] Implement validated role/request schemas and RPC adapters with Zod.
- [ ] Extend room management mapping with `isCurrentUserManager` and the `manager` role.
- [ ] Run entity tests.

### Task 3: 공통 독서 상태와 방 정보 허브

**Files:**
- Create: `apps/web/src/shared/ui/ReadingStatus.tsx`
- Create: `apps/web/src/shared/ui/ReadingStatus.test.tsx`
- Modify: `apps/web/src/pages/rooms/RoomDetailPage.tsx`
- Modify: `apps/web/src/pages/rooms/RoomManagementPage.tsx`
- Modify: `apps/web/src/pages/rooms/RoomManagementPage.test.tsx`
- Modify: `apps/web/src/pages/profile/MyReadingBooksPage.tsx`

**Interfaces:**
- Produces common `ReadingStatus({ progress, isCompleted })` display.
- Consumes `ReadingProgress`, completion ids, and `RoomManagement` role capabilities.

- [ ] Write failing component tests for progress, completed badge, owner-only hub CTA, and manager content CTA.
- [ ] Replace duplicate progress markup with `ReadingStatus` in room detail and my reading books.
- [ ] Convert `/rooms/:roomId/manage` title to `방 정보`, remove `새 책` from room detail, and render role-appropriate cards for invite, books, members, settings, requests, and leaving.
- [ ] Add owner-only member role selection sheet with explicit saving and confirmation for ownership transfer.
- [ ] Run focused page and shared UI tests.

### Task 4: 책 추가 요청과 메시지 추가 축소

**Files:**
- Modify: `apps/web/src/pages/rooms/BookDiscussionPage.tsx`
- Modify: `apps/web/src/pages/rooms/BookDiscussionPage.test.tsx`
- Modify: `apps/web/src/pages/rooms/BookSearchPage.tsx`
- Modify: `apps/web/src/pages/rooms/BookSearchPage.test.tsx`
- Modify: `apps/web/src/pages/rooms/BookChatManagementPage.tsx`
- Modify: `apps/web/src/pages/rooms/BookChatManagementPage.test.tsx`

**Interfaces:**
- `+` opens only label registration and current-book video archive.
- Book chat management owns progress and completion actions.

- [ ] Write failing interaction tests for two-item message sheet, label sub-flow, and management spacing/actions.
- [ ] Remove video upload, completion, and room invite actions from the message sheet.
- [ ] Move page/chapter selection under one `라벨 등록` entry.
- [ ] Make non-managing members submit a book proposal from the book search result instead of creating the chat directly.
- [ ] Add progress edit action and `완독 기록 남기기` copy to book chat management.
- [ ] Run focused page tests.

### Task 5: 책방 전체 영상 기록

**Files:**
- Create: `apps/web/src/pages/rooms/RoomVideoArchivePage.tsx`
- Create: `apps/web/src/pages/rooms/RoomVideoArchivePage.test.tsx`
- Modify: `apps/web/src/entities/video/video.ts`
- Modify: `apps/web/src/app/router/router.tsx`
- Modify: `apps/web/src/app/router/LazyVideoRoutes.tsx`
- Modify: `apps/web/src/pages/rooms/RoomDetailPage.tsx`
- Modify: `apps/web/src/pages/rooms/VideoArchivePage.tsx`

**Interfaces:**
- Produces `/rooms/:roomId/videos`, grouped room video posts and book filter values.
- Keeps `/rooms/:roomId/books/:bookChatId/videos` as the current-book archive.

- [ ] Write failing unit tests for grouping/filtering room video posts and a page test for book filter navigation.
- [ ] Add a validated room video query that joins video posts to accessible book chats.
- [ ] Add a lazy room-level archive route with book chips and the existing gallery item/player behavior.
- [ ] Add recent-video preview and `전체 영상 기록` CTA to room detail.
- [ ] Add `책방 전체 영상 기록 보기` in book-level archive.
- [ ] Run focused video tests.

### Task 6: Browser coverage and documentation

**Files:**
- Modify: `apps/web/e2e/ui-health.spec.ts`
- Modify: `openwiki/product-flows.md`
- Modify: `openwiki/security-operations.md`

- [ ] Add Playwright flows for member vs manager vs owner CTA visibility, simplified `+`, room video archive, and 320px/640px layout.
- [ ] Update user flow and permission contract documentation.
- [ ] Run all required web tests, build, Playwright, and database tests where the local Supabase environment is available.
- [ ] Commit only files for this feature after each independently reviewed task.
