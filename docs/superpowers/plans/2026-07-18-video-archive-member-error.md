# 영상 보관함 멤버 조회 오류 처리 구현 계획

> **에이전트 작업 필수 절차:** 이 계획은 `subagent-driven-development` 방식으로 작업한다. 구현 뒤에는 명세와 코드 품질을 각각 검토한다.

**목표:** 영상 보관함의 멤버 필터 조회가 실패했을 때 빈 목록처럼 숨기지 않고, 안내와 재시도를 제공한다.

**구조:** `VideoArchivePage`가 TanStack Query의 오류 상태와 `refetch`를 `VideoFilters`에 전달한다. 필터 컴포넌트는 정상 빈 목록·로딩·오류를 명확히 분리하며, raw Supabase 응답은 기존 entity 경계 밖으로 내보내지 않는다.

**기술:** React, TypeScript strict, TanStack Query, Vitest, Testing Library

---

### 작업 1: 오류 상태 회귀 테스트

**파일:**
- 수정: `apps/web/src/pages/rooms/VideoArchivePage.test.tsx`

- [ ] **단계 1: 실패하는 테스트를 작성한다.**

```ts
it('shows retry feedback when member filters cannot load', async () => {
  getVideoFilterMembers.mockRejectedValueOnce(new Error('network'))
  renderVideoArchivePage()

  fireEvent.click(await screen.findByRole('button', { name: '멤버별 보기' }))

  expect(screen.getByRole('alert')).toHaveTextContent('멤버를 불러오지 못했어요')
  expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument()
})
```

- [ ] **단계 2: 현재 빈 상태만 보이는 이유로 실패하는지 확인한다.**

실행: `pnpm --filter web test -- VideoArchivePage.test.tsx`

### 작업 2: 오류 안내와 재시도 구현

**파일:**
- 수정: `apps/web/src/pages/rooms/VideoArchivePage.tsx`
- 수정: `apps/web/src/pages/rooms/VideoArchivePage.test.tsx`

- [ ] **단계 1: Query 오류와 재시도 callback을 필터 UI에 전달한다.**

```ts
hasMemberLoadError={membersQuery.isError}
onRetryMembers={() => void membersQuery.refetch()}
```

- [ ] **단계 2: 오류 상태를 44px 재시도 버튼과 `role="alert"`로 렌더링한다.**

정상 빈 상태의 “멤버가 없어요” 안내는 유지하며, 오류 상태와 절대 섞지 않는다.

- [ ] **단계 3: 테스트를 다시 실행해 통과를 확인한다.**

실행: `pnpm --filter web test -- VideoArchivePage.test.tsx`

### 작업 3: 검토와 검증

**파일:**
- 수정 없음

- [ ] **단계 1: 명세 검토를 수행한다.**

확인: 정상 빈 상태·오류 상태의 구분, 재시도 동작, 44px 터치 영역, 320px 가로 overflow가 없는지 확인한다.

- [ ] **단계 2: 코드 품질 검토를 수행한다.**

확인: 도메인 경계, JSDoc, strict TypeScript, UI 토큰, 테스트의 실제 오류 경로를 검토한다.

- [ ] **단계 3: 전체 웹 검증을 실행하고 커밋·PR을 생성한다.**

```bash
pnpm format:web
pnpm lint:web
pnpm typecheck:web
pnpm docs:functions:web
pnpm test:web
pnpm build:web
pnpm test:e2e:web
```
