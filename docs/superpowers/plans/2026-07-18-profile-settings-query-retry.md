# 프로필·계정 설정 조회 오류 복구 구현 계획

## 목표

프로필, 완독 도서, 알림 설정의 조회 실패를 빈 상태나 저장 실패로 잘못 안내하지 않고,
사용자가 해당 조회만 다시 시도할 수 있게 한다.

## 완료 기준

- 프로필 조회 실패는 전체 로딩 화면이 아니라 오류 문구와 재시도 버튼을 표시한다.
- 프로필 재시도 중에는 책 로딩 애니메이션과 재시도 중 문구를 표시한다.
- 완독 도서 조회 실패는 빈 상태와 구분하고 재시도할 수 있다.
- 완독 도서의 이전 목록 데이터가 있으면 조회 실패 뒤에도 목록을 유지한다.
- 알림 설정 조회 실패와 저장 실패는 서로 다른 문구로 표시한다.
- 알림 설정 조회 실패는 재시도할 수 있고, 재시도 중에는 책 로딩 애니메이션과 비활성 버튼을 표시한다.

## 검증

- ProfilePage와 AccountSettingsPage의 React Testing Library 회귀 테스트
- `pnpm format:web`
- `pnpm lint:web`
- `pnpm typecheck:web`
- `pnpm docs:functions:web`
- `pnpm test:web`
- `pnpm build:web`
- `pnpm test:e2e:web`
