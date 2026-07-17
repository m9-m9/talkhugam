# UI Health Playwright 검증 확대 계획

**목표:** 최소 320px와 앱 최대 폭 640px에서 핵심 화면의 가로 넘침, 접근성, 오버레이 회귀를 브라우저 수준에서 확인한다.

## 범위

1. Playwright 프로젝트를 `mobile-320`, `desktop-640`으로 명시한다.
2. 독서방 생성·참여, 프로필, 계정 설정, 알림함, 독서방 목록의 가로 넘침을 실제 인증 fixture와 응답 fixture로 검사한다.
3. 프로필, 계정 설정, 알림함에서 axe-core 자동 접근성 위반이 없는지 검사한다.
4. 하단 액션 책자와 계정 삭제 확인창의 Escape, 외부 클릭, 트리거 포커스 복귀를 브라우저에서 회귀 검사한다.
5. format, lint, typecheck, JSDoc 검사, Vitest, build, Playwright를 실행한다.

## 완료 기준

- 320px와 640px에서 지정한 핵심 페이지의 `html.scrollWidth`가 viewport 폭을 넘지 않는다.
- 지정한 세 화면의 axe-core 자동 위반이 없다.
- 두 오버레이가 Escape·외부 클릭으로 닫히며 원래 버튼에 포커스를 돌려준다.
- 로컬 자동 검증을 모두 통과한다.
