# 책 대화 멘션 입력 구현 계획

> **에이전트 작업 필수 절차:** 이 계획은 `subagent-driven-development` 방식으로 작업한다. 구현 담당 뒤에는 명세 검토와 코드 품질 검토를 각각 수행한다.

**목표:** 독서방의 활성 멤버를 책 대화 또는 답글에 멘션하고, 기존 Supabase RPC가 해당 멤버에게 알림을 생성하도록 연결한다.

**구조:** 기존 `entities/post`의 입력 모델에 멘션한 `room_members.id` 배열을 추가하고, 이미 존재하는 `create_post`·`create_reply` RPC 인자에 전달한다. `BookDiscussionPage`는 현재 영상 필터가 사용하는 검증된 멤버 목록을 조회하여, 채팅 추가 메뉴에서 선택·해제 가능한 멘션 UI를 제공한다.

**기술:** React, TypeScript strict, TanStack Query, Zod, Supabase RPC, Vitest, Testing Library

---

### 작업 1: 멘션 입력 도메인 모델과 RPC 전달

**파일:**
- 수정: `apps/web/src/entities/post/post.ts`
- 수정: `apps/web/src/entities/post/post.test.ts`

- [ ] **단계 1: 실패하는 도메인 테스트를 작성한다.**

```ts
it('keeps validated mentioned member ids with a post form', () => {
  expect(
    parsePostForm({
      body: '같이 읽어 봐요',
      labels: [],
      mentionedMemberIds: ['11111111-1111-4111-8111-111111111111'],
    }),
  ).toEqual({
    body: '같이 읽어 봐요',
    labels: [],
    mentionedMemberIds: ['11111111-1111-4111-8111-111111111111'],
  })
})
```

- [ ] **단계 2: 테스트가 `mentionedMemberIds` 누락으로 실패하는지 확인한다.**

실행: `pnpm --filter web test -- post.test.ts`

- [ ] **단계 3: Zod 입력 모델에 최대 6개의 UUID 멘션 ID를 추가한다.**

```ts
mentionedMemberIds: z.array(z.string().uuid()).max(6).default([])
```

`createPost`는 `p_mentioned_member_ids: values.mentionedMemberIds`를, `createReply`는 같은 인자를 `create_reply`에 전달한다. 기존 본문·라벨 입력은 빈 배열 기본값으로 호환성을 유지한다.

- [ ] **단계 4: 단위 테스트를 다시 실행해 통과를 확인한다.**

실행: `pnpm --filter web test -- post.test.ts`

### 작업 2: 채팅 추가 메뉴의 멤션 선택 UI

**파일:**
- 수정: `apps/web/src/pages/rooms/BookDiscussionPage.tsx`
- 수정: `apps/web/src/pages/rooms/BookDiscussionPage.test.tsx`

- [ ] **단계 1: 실패하는 컴포넌트 테스트를 작성한다.**

```ts
it('keeps selected mentions when the action menu closes', async () => {
  renderBookDiscussionPage()
  fireEvent.click(screen.getByRole('button', { name: '메시지 추가 메뉴 열기' }))
  fireEvent.click(screen.getByRole('button', { name: '멤버 멘션' }))
  fireEvent.click(await screen.findByRole('button', { name: '민지 멘션' }))
  fireEvent.pointerDown(document.body)
  fireEvent.click(screen.getByRole('button', { name: '메시지 추가 메뉴 열기' }))
  expect(screen.getByText('민지')).toBeInTheDocument()
})
```

- [ ] **단계 2: 테스트가 멤션 메뉴 부재로 실패하는지 확인한다.**

실행: `pnpm --filter web test -- BookDiscussionPage.test.tsx`

- [ ] **단계 3: 활성 독서방 멤버를 TanStack Query로 조회하고 UI에 연결한다.**

`getVideoFilterMembers(client, roomId)`를 재사용한다. 현재 사용자는 목록에서 제외하고, 선택한 멤버는 입력창 위의 칩으로 렌더링하며 제거 버튼은 최소 44px 터치 영역을 유지한다. 메뉴 밖 클릭·Escape·닫기 버튼은 메뉴만 닫고 본문·라벨·멘션 선택을 유지한다.

- [ ] **단계 4: 전송과 답글 흐름에 멘션 배열을 포함한다.**

```ts
const parsed = postInput(draft, labels, mentionedMemberIds)
if (replyTo) await createReply(createSupabaseClient(), replyTo, parsed.value)
else await createPost(createSupabaseClient(), bookChatId, parsed.value)
```

성공 시에만 본문·라벨·멘션·답글 대상을 모두 초기화한다.

- [ ] **단계 5: 컴포넌트 테스트를 다시 실행해 통과를 확인한다.**

실행: `pnpm --filter web test -- BookDiscussionPage.test.tsx`

### 작업 3: 회귀 검증과 리뷰

**파일:**
- 수정 없음

- [ ] **단계 1: 명세 검토를 수행한다.**

확인: 새 migration·Secret 없이 기존 RPC를 사용하고, 새 글과 답글 모두 멘션 ID를 전달하며, 메뉴를 닫아도 작성 중 입력이 유지되는지 검토한다.

- [ ] **단계 2: 코드 품질 검토를 수행한다.**

확인: Zod 검증, UI에 raw row 미노출, Korean JSDoc, 중첩 depth 2 이하, 키보드·스크린리더·44px 터치 영역을 확인한다.

- [ ] **단계 3: 전체 검증을 실행한다.**

```bash
pnpm format:web
pnpm lint:web
pnpm typecheck:web
pnpm docs:functions:web
pnpm test:web
pnpm build:web
pnpm test:e2e:web
```

- [ ] **단계 4: 티켓 단위 커밋·PR을 생성한다.**

```bash
git commit -m "feat(chat): 책 대화 멘션 입력 흐름 추가"
```
