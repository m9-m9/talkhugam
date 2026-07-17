# 오버레이 포커스와 Select 키보드 조작 구현 계획

## 목표

- 하단 모임 시작 책자, 계정 삭제 확인창, 영상 필터 Select를 키보드와 보조기술로 완결성 있게 조작한다.

## 완료 기준

- 책자를 열면 첫 선택지에 포커스하고, Escape·외부 클릭으로 닫으면 + 버튼으로 포커스를 돌린다.
- 계정 삭제 확인창은 `aria-modal` 대화상자로 동작하며, 첫 항목 포커스·Tab 순환·Escape/배경 닫힘 뒤 트리거 복귀를 제공한다.
- Select는 화살표, Home/End로 옵션 포커스를 옮기고 Enter/Space로 선택하며 Escape로 트리거에 복귀한다.
- RTL 키보드 회귀 테스트와 format·lint·typecheck·Vitest·build·Playwright 검증을 통과한다.
