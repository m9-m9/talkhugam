# 책방 생성 완료 직접 공유 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 책방 생성 완료 화면에서 카카오톡·인스타그램·페이스북으로 즉시 초대 링크를 공유하고 초대 코드 복사 결과를 토스트로 알린다.

**Architecture:** 공유 전용 브랜치를 `feat/talk-101-seed-design-system` 위에 재배치해 현재 SEED UI를 기준으로 한다. 생성 RPC가 이미 한 번만 반환하는 초대 토큰을 `CreatedRoomInvite`가 보존하고, 완료 화면이 기존 `features/invite-sharing` 유틸리티로 채널별 공유를 수행한다. 토스트는 SEED Snackbar의 화면 전용 region으로 렌더링하며 토큰은 React 상태를 벗어나 저장하지 않는다.

**Tech Stack:** React 19, TypeScript strict, TanStack Query, Vitest, React Testing Library, Playwright, `@seed-design/react`, `@seed-design/react-snackbar`, Supabase RPC.

## Global Constraints

- `feat/talk-102-invite-sharing-completion`은 `feat/talk-101-seed-design-system`을 기반으로 한다.
- 초대 토큰은 생성 직후 화면 메모리와 실제 참여 URL에만 존재하며 로그·분석·DB에 추가 기록하지 않는다.
- 초대 코드 복사 성공 메시지는 정확히 `초대 코드를 복사했어요.`, 실패 메시지는 정확히 `초대 코드를 복사하지 못했어요.`다.
- 카카오 SDK 키가 없거나 SDK 호출이 실패하면 `navigator.share`를 시도하고, 인스타그램은 복사 후 웹을 연다.
- 320px과 640px에서 모든 공유·복사 버튼은 44px 이상이며, 완료 화면에 가로 오버플로가 없어야 한다.

---

### Task 1: SEED 기반 브랜치와 Snackbar 기반을 준비한다

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/src/shared/styles/globals.css`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: `feat/talk-101-seed-design-system`의 SEED UI·토큰·CSS import 구조
- Produces: `@seed-design/react-snackbar`와 Snackbar recipe CSS를 사용할 수 있는 앱 기반

- [ ] **Step 1: 공유 브랜치를 SEED 리뉴얼 브랜치 위로 재배치한다**

Run:
```bash
git rebase feat/talk-101-seed-design-system
```

Expected: `63dac44` 문서 커밋만 새 기반 위로 재적용되고, `CreateRoomPage.tsx`에 `ActionButton`과 `TextField`가 존재한다.

- [ ] **Step 2: 최소 Snackbar 기반을 추가한다**

`@seed-design/react-snackbar`의 SEED 2.x 호환 버전을 workspace 의존성으로 추가하고, `globals.css`에 다음 recipe를 import한다.

```css
@import '@seed-design/css/recipes/snackbar.css';
@import '@seed-design/css/recipes/snackbar-region.css';
```

`Snackbar.RootProvider`, `Snackbar.Region`, `Snackbar.Renderer`를 완료 화면에 둘 수 있도록 import 경로와 타입 검사를 맞춘다.

- [ ] **Step 3: 패키지와 CSS 기반을 검증한다**

Run:
```bash
pnpm --filter @talkhugam/web add @seed-design/react-snackbar@^2.0.0
pnpm --filter @talkhugam/web test -- CreateRoomPage.test.tsx
```

Expected: 의존성 lockfile이 갱신되고 기존 완료 화면 테스트가 통과한다.

- [ ] **Step 4: 기반 변경을 커밋한다**

```bash
git add apps/web/package.json apps/web/src/shared/styles/globals.css pnpm-lock.yaml
git commit -m "chore(ui): SEED 스낵바 기반 추가"
```

### Task 2: 생성 초대 결과에 일회성 링크 토큰을 보존한다

**Files:**
- Modify: `apps/web/src/entities/reading-room/roomEntry.ts`
- Modify: `apps/web/src/entities/reading-room/roomEntry.test.ts`

**Interfaces:**
- Consumes: `create_room_invite` RPC 결과 `{ code, expires_at, token }`
- Produces: `CreatedRoomInvite = { code: string; expiresAt: string; roomId: string; token: string }`

- [ ] **Step 1: RPC 결과 토큰을 요구하는 실패 테스트를 작성한다**

`roomEntry.test.ts`에서 RPC 결과 parser를 테스트 가능한 순수 함수로 공개하거나 `createRoomWithInvite`의 Supabase client를 mock하여 다음 결과를 기대한다.

```ts
expect(createdInvite).toMatchObject({
  code: 'TALK87',
  token: 'a'.repeat(64),
})
```

Run:
```bash
pnpm --filter @talkhugam/web test -- roomEntry.test.ts
```

Expected: 현재 schema가 `token`을 허용하지 않아 실패한다.

- [ ] **Step 2: 초대 schema와 도메인 타입을 최소 변경한다**

`inviteResultSchema`와 `CreatedRoomInvite`에 아래 속성을 추가하고 `createInvite`와 `createRoomWithInvite`가 전달한다.

```ts
token: z.string().regex(/^[a-f0-9]{64}$/)

export type CreatedRoomInvite = {
  code: string
  expiresAt: string
  roomId: string
  token: string
}
```

- [ ] **Step 3: 토큰 보존 테스트를 통과시킨다**

Run:
```bash
pnpm --filter @talkhugam/web test -- roomEntry.test.ts
```

Expected: 유효 토큰은 보존되고, 잘못된 토큰은 Zod 검증에서 거부된다.

- [ ] **Step 4: 도메인 변경을 커밋한다**

```bash
git add apps/web/src/entities/reading-room/roomEntry.ts apps/web/src/entities/reading-room/roomEntry.test.ts
git commit -m "feat(invite): 생성 초대 링크 토큰 보존"
```

### Task 3: 완료 화면에 직접 공유와 복사 토스트를 구현한다

**Files:**
- Modify: `apps/web/src/pages/rooms/CreateRoomPage.tsx`
- Modify: `apps/web/src/pages/rooms/CreateRoomPage.test.tsx`
- Reuse: `apps/web/src/features/invite-sharing/inviteShare.ts`

**Interfaces:**
- Consumes: `CreatedRoomInvite.token`, `createInviteShareData`, `copyInviteText`, `getInviteCopyText`, `getInvitePlatformUrl`, `shareInviteWithKakao`, `getClientEnv`
- Produces: 완료 화면의 `카카오톡으로 초대 보내기`, `인스타그램으로 초대 보내기`, `페이스북으로 초대 보내기`, `초대 코드 복사하기` 행동과 Snackbar status 메시지

- [ ] **Step 1: 완료 화면의 실패 테스트를 먼저 작성한다**

`CreateRoomPage.test.tsx`에서 생성 mock을 토큰 포함 값으로 바꾸고, 아래의 화면·행동을 검증한다.

```tsx
createRoomWithInvite.mockResolvedValue({
  code: 'TALK87',
  expiresAt: '2026-08-02T00:00:00.000Z',
  roomId: '00000000-0000-4000-8000-000000000001',
  token: 'a'.repeat(64),
})

expect(await screen.findByRole('button', { name: '카카오톡으로 초대 보내기' })).toBeVisible()
expect(screen.getByRole('button', { name: '인스타그램으로 초대 보내기' })).toBeVisible()
expect(screen.getByRole('button', { name: '페이스북으로 초대 보내기' })).toBeVisible()
```

Mock `copyInviteText`, `shareInviteWithKakao`, `window.open`, `navigator.share`, `navigator.clipboard`를 사용해 다음도 검증한다.

```tsx
await user.click(screen.getByRole('button', { name: '초대 코드 복사하기' }))
expect(await screen.findByRole('status')).toHaveTextContent('초대 코드를 복사했어요.')
```

Run:
```bash
pnpm --filter @talkhugam/web test -- CreateRoomPage.test.tsx
```

Expected: 채널 버튼과 Snackbar가 없어 실패한다.

- [ ] **Step 2: 완료 화면 전용 공유 데이터를 구성한다**

`handleSubmit`에서 성공한 `values.name`을 `RoomCreatedPage`에 전달한다. 완료 화면에서 아래와 같이 기존 공유 유틸리티를 호출한다.

```ts
const shareData = createInviteShareData(window.location.origin, roomName, invite)
```

`handleShareInvite(platform)`은 카카오 SDK, 인스타그램 복사 후 열기, Facebook sharer 열기를 기존 방 관리 화면과 같은 규칙으로 수행한다. 카카오 fallback은 `navigator.share(shareData)` 후 실패를 Snackbar 오류로 알린다.

- [ ] **Step 3: SEED 공유 버튼과 Snackbar를 렌더링한다**

초대 코드 카드 아래에 `친구 초대하기` 제목과 3열 grid를 추가한다. 각 `ActionButton`은 `min-h-11`, 같은 grid track, 고유 `aria-label`, 브랜드 식별 아이콘을 가진다. 기존 초대 코드 복사 버튼은 `copyInviteText(invite.code)`를 호출하고, 버튼 문구는 변하지 않는다.

Snackbar는 `role="status"` region에 성공 또는 실패 메시지를 3초 동안 표시한다. 인스타그램 성공 메시지는 `초대 링크를 복사했어요. 인스타그램에서 붙여넣어 보내세요.`다.

- [ ] **Step 4: 완료 화면 단위 테스트를 통과시킨다**

Run:
```bash
pnpm --filter @talkhugam/web test -- CreateRoomPage.test.tsx inviteShare.test.ts
```

Expected: 코드 복사 성공·실패, 카카오 SDK/fallback, 인스타그램 복사, Facebook URL, 접근 가능한 버튼 이름이 모두 통과한다.

- [ ] **Step 5: 완료 화면 변경을 커밋한다**

```bash
git add apps/web/src/pages/rooms/CreateRoomPage.tsx apps/web/src/pages/rooms/CreateRoomPage.test.tsx
git commit -m "feat(invite): 생성 완료 화면 직접 공유 추가"
```

### Task 4: 320px·640px 화면과 전체 회귀를 검증한다

**Files:**
- Modify: `apps/web/e2e/ui-health.spec.ts`

**Interfaces:**
- Consumes: 생성 완료 화면의 4개 행동 버튼과 `role="status"` Snackbar
- Produces: 320px·640px에서 직접 공유 레이아웃과 토스트의 회귀 방지

- [ ] **Step 1: 브라우저 실패 시나리오를 작성한다**

생성 RPC mock이 토큰을 반환하도록 하고, 완료 화면에서 3개 공유 버튼과 코드 복사 버튼을 찾는다.

```ts
await expect(page.getByRole('button', { name: '카카오톡으로 초대 보내기' })).toBeVisible()
await expect(page.getByRole('button', { name: '인스타그램으로 초대 보내기' })).toBeVisible()
await expect(page.getByRole('button', { name: '페이스북으로 초대 보내기' })).toBeVisible()
await expectPageToFitViewport(page, testInfo.project.use.viewport?.width ?? 640)
```

코드 복사 후 `role=status`의 성공 메시지를 확인하고 `artifacts/seed-comparison/create-room-share-after-<project>.png`를 저장한다.

- [ ] **Step 2: 새 브라우저 검사를 통과시킨다**

Run:
```bash
pnpm --filter @talkhugam/web exec playwright test --grep "shares a newly created room" --workers=1
```

Expected: mobile-320과 desktop-640 모두 버튼 정렬, 토스트, 가로 오버플로 검사를 통과한다.

- [ ] **Step 3: 전체 검증을 실행한다**

Run:
```bash
pnpm test:web
pnpm build:web
pnpm --filter @talkhugam/web test:e2e
```

Expected: Vitest, production build, 전체 Playwright가 통과한다. Mux 번들 크기 경고가 나오면 기존 경고로 기록한다.

- [ ] **Step 4: 검증 변경을 커밋하고 브랜치를 푸시한다**

```bash
git add apps/web/e2e/ui-health.spec.ts
git commit -m "test(invite): 생성 완료 공유 화면 검증 추가"
git push -u origin feat/talk-102-invite-sharing-completion
```
