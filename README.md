# Talk후감

가까운 사람들과 비공개 책방에서 책에 관한 대화와 30초 독서 순간 영상을 쌓는 기록형 서비스입니다.

## 제품 로드맵

### Phase 1 · 관계 기반 독서 기록 MVP (구현)

- 최대 6명의 지인이 비공개 **책방**에서 책별 대화·답글·멘션과 30초 독서 영상을 함께 축적
- 초대 코드 참여, 소셜 로그인, 개인 완독·별점·총평, 멤버·계정 관리까지 모바일 웹 흐름 완성
- Supabase RLS·Realtime과 Mux를 연결하고 320px/640px Playwright 검증으로 출시 품질 기준 마련

### Phase 2 · 앱 전환과 재방문 경험 확장 (계획)

- Capacitor 기반 iOS·Android 패키징, 네이티브 카메라·파일 선택, APNs·FCM 푸시 알림 도입
- 앱 딥링크와 초대 링크를 연결하고, Draft 서버 동기화·공개방·GPS 장소 태그를 단계적으로 검증

## Phase 1 상세

- 모바일 우선 웹
- 책방 최대 6명
- 책별 대화, 독후감, 답글, 멘션, 앱 내 알림
- 개인별 완독 체크, 별점·총평, 내가 완독한 책
- 30초 영상 업로드와 재생
- Kakao, Naver, Google 로그인
- 알림 수신 설정과 기록 처리 방식을 고르는 계정 삭제

## 기술 스택

- React, Vite, TypeScript strict
- Supabase Auth, PostgreSQL, Realtime, Edge Functions
- Mux Video
- TanStack Query, React Hook Form, Zod
- Tailwind CSS
- Vitest, Testing Library, Playwright

## 로컬 개발

```bash
# Node.js 22를 사용합니다. nvm을 쓴다면 먼저 nvm use를 실행하세요.
pnpm install
pnpm dev:web
```

웹 앱은 `apps/web`에 있습니다. Supabase migration과 Edge Function은 저장소 루트의 `supabase`에서 관리합니다.
저장소 루트의 `.nvmrc`는 로컬과 CI가 같은 Node.js 22를 쓰도록 안내합니다.

로컬 브라우저 주소는 `http://localhost:5173`입니다. `.env.example`을 복사해 환경 파일을 만들 때도
`ALLOWED_ORIGINS`, `ALLOWED_AUTH_REDIRECTS`, `TEST_ORIGIN`은 예시에 있는 5173 값을 그대로 유지하세요.
`localhost`와 `127.0.0.1`을 오가며 접속해도 되도록 두 주소를 모두 허용 목록에 포함해 두었습니다.

## 품질 검증

```bash
pnpm format:web
pnpm lint:web
pnpm typecheck:web
pnpm test:web
pnpm build:web
pnpm test:e2e:web
```

`test:e2e:web`는 실제 Chromium에서 320px와 640px 화면 폭을 검사합니다. 캔버스 폭과 가로 넘침, 채팅 추가 메뉴의 열기·닫기, axe-core 접근성 검사를 포함합니다.

PR에서는 Frontend CI가 위 웹 품질 검증과 브라우저 UI 검사를, Backend CI가 migration·RLS·Edge Function 검증을 자동 실행합니다.

## 환경 변수

브라우저용 값은 `apps/web/.env.local`, Edge Function용 비밀값은 `supabase/functions/.env.local`에 둡니다.
각 `.env.example`에 있는 키만 복사하고, 실제 키·토큰·사용자 정보는 커밋하지 않습니다.

| 구분         | 파일                            | 예시 키                                                                  |
| ------------ | ------------------------------- | ------------------------------------------------------------------------ |
| 웹 공개 설정 | `apps/web/.env.local`           | `VITE_SUPABASE_URL`, `VITE_GA_MEASUREMENT_ID`, `VITE_CLARITY_PROJECT_ID` |
| 서버 비밀값  | `supabase/functions/.env.local` | `MUX_TOKEN_SECRET`, `NAVER_CLIENT_SECRET`, `DELETION_WORKER_SECRET`      |

운영 환경의 동일한 값은 Vercel과 Supabase Edge Function Secrets에 각각 설정합니다. 세부 입력 위치는 [출시 정책·문의 화면 계획](docs/legal-launch.md)을 따릅니다.
