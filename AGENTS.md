# AGENTS.md

이 파일은 Talk후감 저장소에서 작업하는 사람과 자동화 에이전트가 지켜야 할 기본 규칙이다.

## 작업 원칙

- 작업 보드의 티켓 하나를 브랜치 하나와 PR 하나로 처리한다.
- 관계없는 변경을 같은 PR에 섞지 않는다.
- 동작을 바꾸기 전에 관련 기획, 권한 정책, 완료 기준을 확인한다.
- 작은 단위로 구현하고 관련 검증을 통과시킨 뒤 다음 단계로 이동한다.
- 사용자가 웹 대시보드·개발자 콘솔·외부 서비스에서 직접 값을 설정해야 하면, 비개발자도
  따라 할 수 있도록 **접속할 웹사이트, 메뉴 이동 경로, 입력할 필드 이름과 값의 출처,
  저장 방법, 완료 여부를 확인하는 방법**을 순서대로 안내한다. 비밀값 자체는 채팅이나
  커밋에 남기지 않으며, 값이 없으면 생성·확인해야 할 서비스 위치를 함께 설명한다.

## TypeScript와 함수

- TypeScript strict 설정을 유지한다.
- 가능한 한 순수 함수를 우선한다. 입력과 출력이 같은 함수 안에서 네트워크, 저장소, 시간, 전역 상태 같은 부수 효과를 섞지 않는다.
- 부수 효과는 API adapter, repository, mutation, event handler 같은 경계에 모은다.
- 제어 흐름의 중첩 depth는 최대 2로 제한한다. `if`, 반복문, `try`가 깊어지면 guard clause, 조기 반환, 함수 추출을 사용한다.
- 함수는 하나의 책임만 가지며 이름은 동사로 시작한다.
- `any`, 반복적인 non-null assertion, 검증 없는 type assertion을 사용하지 않는다.
- 외부 입력은 `unknown`으로 받고 Zod로 검증한 뒤 도메인 타입으로 변환한다.
- React 컴포넌트는 서버 데이터를 직접 가공하기보다 검증된 도메인 모델을 입력으로 받는다.

## 네이밍

- 변수와 함수는 `camelCase`, 컴포넌트와 타입은 `PascalCase`를 사용한다.
- Boolean은 `is`, `has`, `can`, `should`, `was`로 시작한다.
- React callback prop은 `onSubmit`, 내부 handler는 `handleSubmit` 형태로 구분한다.
- 디렉터리는 `kebab-case`, React 컴포넌트 파일은 `PascalCase.tsx`, 일반 TypeScript 파일은 `camelCase.ts`를 사용한다.
- PostgreSQL 식별자는 `snake_case`, TypeScript 도메인 모델은 `camelCase`를 사용한다.
- 의미가 드러나지 않는 `data`, `item`, `temp`, `utils`, `helpers` 이름을 피한다.

## 아키텍처 경계

- `pages`는 라우트를 조립하고, `features`는 사용자 행동, `entities`는 도메인, `shared`는 공통 기반을 담당한다.
- feature와 entity는 공개 `index.ts` 경계를 통해 사용한다.
- Supabase raw Row 타입을 UI까지 전달하지 않는다. repository 또는 mapper에서 도메인 타입으로 변환한다.
- 서버 상태는 TanStack Query로 관리하고 Supabase session이나 서버 데이터를 Zustand에 복제하지 않는다.
- 브라우저 공개 환경변수는 `src/app/env.ts`에서 한 번 검증하고 직접 `import.meta.env`에 접근하지 않는다.

## Supabase와 보안

- Dashboard에서만 DB를 수정하지 않는다. 모든 스키마, 인덱스, 함수, trigger, RLS 변경은 migration으로 기록한다.
- 공개 스키마의 테이블은 RLS를 활성화하고 허용·거부 케이스를 모두 테스트한다.
- Service Role, OAuth secret, Mux secret과 서명 키를 브라우저 코드에 노출하지 않는다.
- 외부 API, webhook, 관리자 권한 작업은 Edge Function 또는 PostgreSQL 함수 경계에서 처리한다.
- 생성된 `database.types.ts`는 직접 수정하지 않는다.
- 개인정보, 채팅 본문, 초대 코드, 토큰, 영상 URL을 로그나 분석 이벤트에 남기지 않는다.

## UI

- Figma Foundations의 spacing `0/4/8/12/16/24/32/40/48/64`와 정의된 radius token만 사용한다.
- 최소 지원 화면 폭은 320px이다. 320px에서 먼저 텍스트, 터치 영역, 줄바꿈을 검증한다.
- 앱은 데스크톱에서 최대 640px의 중앙 정렬 캔버스로 표시한다. 화면 폭을 넓히는 반응형 변형은 기획과 피그마에서 명시적으로 결정된 경우에만 추가한다.
- 화면 좌우 여백은 320px 기준 기본 16px(`px-4`)을 사용한다. 24px 이상 여백은 콘텐츠 폭과 줄바꿈을 확인한 뒤 사용한다.
- 임의 spacing 값과 raw style을 추가하기 전에 공통 token 또는 component variant를 확인한다.
- 터치 영역은 최소 44px로 만들고 키보드 focus, aria label, 로딩, 빈 상태, 오류, 재시도를 함께 구현한다.

## 테스트와 완료 조건

- 테스트는 사용자가 대신 수행하는 절차가 아니라, 구현을 맡은 에이전트의 완료 책임이다. 사용자의
  브라우저 확인은 자동 검증이 끝난 뒤 원할 때 하는 최종 체감 확인으로만 요청한다.
- 구현 완료를 보고하기 전에는 변경 성격에 맞는 자동 검증을 직접 실행한다. 순수 로직은 Vitest,
  React 화면 상태와 사용자 상호작용은 React Testing Library, 브라우저 핵심 흐름은 Playwright,
  Edge Function은 Deno test, DB 권한과 RPC는 pgTAP을 우선 사용한다.
- 외부 플랫폼의 Secret, OAuth 설정, 배포 환경처럼 코드 밖의 값에 의존하는 흐름은 staging 또는
  수동 실행 스모크 테스트로 검증한다. 매 PR에 비용·시간 부담이 큰 실제 외부 호출을 강제하지 말고,
  그 검증 범위와 실행 결과를 완료 보고에 분명히 적는다.
- 완료 보고에는 실행한 검증 명령, 통과 결과, 자동화하지 못한 범위와 그 이유를 짧고 명확하게
  포함한다. 사용자가 직접 확인해야 하는 단계가 남았다면 완료라고 표현하지 않는다.
- 순수 함수, schema, mapper, query key, 상태 머신은 단위 테스트를 작성한다.
- 권한 변경은 RLS 허용·거부 테스트를 작성한다.
- 사용자 흐름 변경은 필요한 컴포넌트 테스트 또는 Playwright 시나리오를 갱신한다.
- 변경 범위에 맞는 lint, typecheck, test, build를 실행한다.
- 테스트를 통과시키기 위해 `skip`, 과도한 timeout, 무의미한 mock을 방치하지 않는다.
- 구현과 문서가 충돌하면 조용히 추측하지 말고 작업 티켓 또는 Product Hub에 결정이 필요한 내용을 남긴다.

## Git

- 브랜치는 `<type>/talk-<ticket-number>-<description>` 형식을 사용한다.
- 커밋은 Conventional Commits 형식인 `<type>(<scope>): <summary>`를 사용한다.
- `main`에 직접 push하지 않고 PR에서 Squash and merge한다. 단, 원격 저장소의 최초 부트스트랩 커밋은 예외로 한다.
- 비밀값, 로컬 환경파일, 실제 사용자 데이터는 커밋하지 않는다.
