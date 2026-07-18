---
type: Product Flow Guide
title: Talk후감 제품 흐름
description: Talk후감 사용자가 로그인, 책방 참여, 책 대화와 독후감 기록, 관리와 피드백까지 진행하는 핵심 흐름을 설명한다.
resource: /apps/web/src/app/router/router.tsx
tags: [talkhugam, product, user-flow, books]
---

# 제품 흐름

이 문서는 현재 라우팅, 화면, entity 및 최근 기능 변경을 기준으로 사용자 여정을 정리한다. 제품 표기는 **책방**, **책 대화**, **독후감**을 사용한다. 구현에서 보이는 `/rooms`, `reading_rooms`, `room_members`는 기술 식별자일 뿐 화면 용어가 아니다.

## 1. 로그인과 이용 준비

1. 사용자는 로그인 화면(`/`)에서 Google·Kakao OAuth 또는 Naver 전용 시작 흐름을 선택한다.
2. OAuth callback(`/auth/callback`)은 인증 이후 약관 동의와 온보딩 상태에 맞는 목적지를 결정한다.
3. 필수 동의가 없으면 `ConsentRequiredRoute`가 `/legal-consent`로 이동시킨다. 동의된 사용자는 온보딩과 앱 내 화면으로 진입한다.

이 흐름은 [`apps/web/src/pages/auth`](../apps/web/src/pages/auth), [`features/auth`](../apps/web/src/features/auth), [`router.tsx`](../apps/web/src/app/router/router.tsx)에 구현되어 있다. 인증만으로 데이터 접근이 허용되는 것은 아니며, 이후의 상태 저장과 권한은 [보안과 운영](./security-operations.md)의 RLS/RPC 경계를 통과한다.

## 2. 책방 목록, 생성, 참여

앱의 기본 책방 화면은 기술 경로 `/rooms`의 `RoomsPage`다. 사용자는 다음 행동을 시작할 수 있다.

- 새 책방 만들기: `/rooms/create`.
- 초대 기반 참여: `/rooms/join`.
- 현재 책방 상세: `/rooms/:roomId`.
- 자신이 만든 보관된 책방: `/rooms/archive`.

README의 Phase 1 제약은 책방당 최대 6명이다. 생성·참여·멤버십 변경은 단순 클라이언트 INSERT가 아니라 DB 규칙과 RPC/RLS가 판단한다. 소유자 전용 멤버 제거처럼 상태를 바꾸는 흐름은 [`supabase/migrations/20260718000500_add_room_management.sql`](../supabase/migrations/20260718000500_add_room_management.sql)의 함수 계약과 [보안과 운영](./security-operations.md)을 함께 변경해야 한다.

## 3. 책 선택과 책 대화

책방 상세에서 책을 추가하려면 `/rooms/:roomId/books/new`의 검색 화면을 사용한다. 등록된 책의 대화 상세는 `/rooms/:roomId/books/:bookChatId`이며, 이 화면은 메시지·답글·멘션과 책별 기록을 조립한다. `entities/book-chat/bookChat.ts`는 책 대화 조회와 생성·상태 변경·삭제 RPC를, `entities/post`는 대화 본문과 답글 관련 도메인 접근을 담당한다.

사용자가 보는 책 대화 흐름은 [아키텍처](./architecture.md)의 `pages → features/entities → Supabase` 경계 위에서 동작한다. 외부 입력과 멤버십·아카이브 상태 검증은 UI가 아니라 서버 RPC와 RLS가 최종 판단하므로, 메시지 기능 변경에는 [테스트](./testing.md)의 컴포넌트 시나리오와 DB 계약 검증이 모두 필요하다.

## 4. 독후감과 개인 완독 기록

각 사용자는 책 대화 안에서 개인적으로 완독을 표시하고 별점·총평 형태의 독후감을 남길 수 있다. `/profile`은 내 정보 수정·책방 보기·읽고 있는 책 보기·계정 설정으로 들어가는 요약 허브이며, `/profile/books`는 참여한 책방의 읽는 책을 모아 보여 준다. 읽는 책 카드의 `완독하기`는 별점·총평 시트를 열고, 이미 완독한 카드의 `기록 수정`은 같은 시트에 기존 값을 채워 다시 연다. `entities/book-completion/bookCompletion.ts`가 이 도메인 접근을 담당하며, `features/book-completion/CompletionReviewForm.tsx`는 완독 기록 작성 UI를 제공한다.

최근 `5c57b9e`는 이 작성 흐름을 분리·정리했고, `4891e1a`는 책 대화 관리와 완독 기록의 흐름을 함께 정리했다. 개인 기록은 책방의 공동 대화와 연결되지만 사용자별 상태이므로, 화면 상태와 서버 저장 모델을 혼동하지 않는다. 관련 화면 변경은 [테스트](./testing.md)의 `book-completion`·프로필·책 대화 테스트를 확인한다.

## 5. 책방과 책 대화 관리

소유자는 `/rooms/:roomId/manage`에서 멤버와 책방을 관리하고, `/rooms/:roomId/manage/settings`에서 설정을 다룬다. 개별 책 대화의 관리 화면은 `/rooms/:roomId/books/:bookChatId/manage`다. 멤버 프로필은 `/rooms/:roomId/members/:profileId`에서 볼 수 있다.

소유자 권한은 화면 버튼만으로 보호하지 않는다. 예를 들어 `remove_room_member` RPC는 호출자가 활성 소유자인지 확인하고, 자기 자신이나 다른 소유자의 제거를 거부한다. 따라서 관리 화면을 고칠 때는 UI 조건뿐 아니라 [보안과 운영](./security-operations.md)의 RPC 권한 계약과 pgTAP 검증을 갱신한다.

## 6. 영상, 알림, 지원 흐름

- 책 대화의 영상 archive와 player는 `/rooms/:roomId/books/:bookChatId/videos` 및 그 하위 경로에서 제공하며 lazy load한다.
- `/notifications`는 앱 내 알림을, `/profile` 및 하위 경로는 프로필·설정·계정 삭제 흐름을 제공한다.
- 앱 전역 피드백 시작점은 `AppNavigationLayout`에 있고, 문의 화면은 `/contact`다. 관리자 피드백 화면은 별도의 `AdminRoute`로 보호된다.

영상 업로드·재생과 계정 삭제는 Mux·Edge Function·삭제 worker를 경유한다. 사용자 흐름을 설명하는 화면과 달리 실제 권한·물리 삭제·장애 대응은 [보안과 운영](./security-operations.md)에 한 번만 정리한다.

## 변경 시 확인

- 용어를 추가·수정할 때는 제품 화면에 책방·책 대화·독후감을 사용하고 기술 식별자를 노출하지 않는다. 이 구분은 최근 `5eda370`의 복사 정리와도 일치한다.
- 새 사용자 분기에는 로딩·빈 상태·오류·재시도·키보드 focus·aria label을 함께 고려한다(`AGENTS.md`).
- 흐름 변경은 [아키텍처](./architecture.md)의 route/guard 및 [테스트](./testing.md)의 최소 검증 범위를 함께 검토한다.
