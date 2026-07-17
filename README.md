# Talk후감

가까운 사람들과 비공개 독서방에서 책에 관한 대화와 30초 독서 순간 영상을 쌓는 기록형 서비스입니다.

## Phase 1

- 모바일 우선 웹
- 독서방 최대 6명
- 책별 채팅, 독후감, 답글, 멘션, 앱 내 알림
- 개인별 완독 체크, 별점·총평, 내가 완독한 책
- 30초 영상 업로드와 재생
- Kakao, Naver, Google 로그인
- 알림 수신 설정과 기록 처리 방식을 고르는 계정 삭제

## 기술 스택

- React, Vite, TypeScript strict
- Supabase Auth, PostgreSQL, Realtime, Edge Functions
- Mux Video
- TanStack Query, React Hook Form, Zod
- Tailwind CSS, shadcn/ui
- Vitest, Testing Library, Playwright

## 로컬 개발

```bash
pnpm install
pnpm dev:web
```

웹 앱은 `apps/web`에 있습니다. Supabase migration과 Edge Function은 저장소 루트의 `supabase`에서 관리합니다.

## 품질 검증

```bash
pnpm format:web
pnpm lint:web
pnpm typecheck:web
pnpm test:web
pnpm build:web
pnpm test:e2e:web
```

`test:e2e:web`는 실제 Chromium에서 320px와 1024px 화면 폭을 검사합니다. 캔버스 폭과 가로 넘침, 채팅 추가 메뉴의 열기·닫기, axe-core 접근성 검사를 포함합니다.

PR에서는 Frontend CI가 위 웹 품질 검증과 브라우저 UI 검사를, Backend CI가 migration·RLS·Edge Function 검증을 자동 실행합니다.
