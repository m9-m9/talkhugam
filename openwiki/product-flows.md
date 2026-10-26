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
3. 필수 동의가 없으면 `ConsentRequiredRoute`가 `/legal-consent`로 이동시킨다. 동의된 사용자는 온보딩과 앱 내 화면으로 진입한다. 필수 동의는 현재 정책 버전(`legalDocumentVersion`, 서버 RPC와 동일)과 일치해야 하므로, 정책을 개정해 버전을 올리면 기존 사용자도 다시 동의해야 한다.

이 흐름은 [`apps/web/src/pages/auth`](../apps/web/src/pages/auth), [`features/auth`](../apps/web/src/features/auth), [`router.tsx`](../apps/web/src/app/router/router.tsx)에 구현되어 있다. 인증만으로 데이터 접근이 허용되는 것은 아니며, 이후의 상태 저장과 권한은 [보안과 운영](./security-operations.md)의 RLS/RPC 경계를 통과한다.

## 2. 책방 목록, 생성, 참여

앱의 기본 책방 화면은 기술 경로 `/rooms`의 `RoomsPage`다. 사용자는 다음 행동을 시작할 수 있다.

- 새 책방 만들기: `/rooms/create`.
- 초대 기반 참여: `/rooms/join`.
- 현재 책방 상세: `/rooms/:roomId`.
- 자신이 만든 보관된 책방: `/rooms/archive`.

README의 Phase 1 제약은 책방당 최대 6명이다. 생성·참여·멤버십 변경은 단순 클라이언트 INSERT가 아니라 DB 규칙과 RPC/RLS가 판단한다. 소유자 전용 멤버 제거처럼 상태를 바꾸는 흐름은 [`supabase/migrations/20260718000500_add_room_management.sql`](../supabase/migrations/20260718000500_add_room_management.sql)의 함수 계약과 [보안과 운영](./security-operations.md)을 함께 변경해야 한다.

## 3. 책 선택과 책 대화

책방 상세에서 책을 추가하려면 `/rooms/:roomId/books/new`의 검색 화면을 사용한다. 책 대화 추가는 2단계 기준으로 모든 활성 멤버가 할 수 있고, 방장·운영자로 제한하고 참여자의 책 제안을 받는 흐름은 4단계(책 제안 요청)에서 추가한다. 책 대화 상태 변경은 방장과 운영자만 할 수 있다. 등록된 책의 대화 상세는 `/rooms/:roomId/books/:bookChatId`이며, 이 화면은 메시지·답글·멘션과 책별 기록을 조립한다. `entities/book-chat/bookChat.ts`는 책 대화 조회와 생성·상태 변경·삭제 RPC를, `entities/post`는 대화 본문과 답글 관련 도메인 접근을 담당한다.

방장과 운영자는 입력창 옆 `+` 메뉴의 `책방 초대하기`에서 초대 코드와 링크를 만들고 카카오톡·문자·인스타그램·페이스북 또는 복사로 공유할 수 있다. 같은 공유 시트는 `/rooms/:roomId/manage`의 초대 코드 만들기 뒤에도 바로 열린다. 참여자는 같은 메뉴의 `초대 요청`으로 방장과 운영자 모두에게 요청을 보내며, 받은 사람은 인앱 알림에서 방 관리 화면으로 바로 이동해 초대 코드를 만들 수 있다. 인스타그램은 웹에서 메시지 자동 입력을 지원하지 않아 먼저 문구를 복사한 뒤 앱에서 붙여 넣도록 안내한다.

사용자가 보는 책 대화 흐름은 [아키텍처](./architecture.md)의 `pages → features/entities → Supabase` 경계 위에서 동작한다. 채팅 입력은 모바일 Safari 확대 없이 작성할 수 있도록 16px을 유지하며, 내 독후감·답글·영상은 오른쪽에, 다른 멤버 기록은 왼쪽에 표시한다. 외부 입력과 멤버십·아카이브 상태 검증은 UI가 아니라 서버 RPC와 RLS가 최종 판단하므로, 메시지 기능 변경에는 [테스트](./testing.md)의 컴포넌트 시나리오와 DB 계약 검증이 모두 필요하다.

## 4. 독후감과 책별 별점 기록

각 사용자는 책 대화 안에서 독후감을 남기고, 책별로 별점(1~5, 필수)과 총평(선택, 1000자 이하)을 기록할 수 있다. 진행률과 완독 표시는 없으며 별점 저장은 알림을 만들지 않는다. 책 대화 관리 화면의 `내 별점` 카드에서 `별점 남기기`·`수정하기`로 같은 시트를 열고, 책 대화 입력창 옆 `+` 메뉴의 `별점`은 평균과 멤버별 별점을 보여 준다. `/profile`은 내 정보 수정·책방 보기·내 책 보기·계정 설정으로 들어가는 요약 허브이며, `/profile/books`(`내 책`)는 참여한 책방의 읽는 중인 책과 종료된(다 읽은) 책을 책방별로 묶어 내 별점 또는 `별점 남기기`와 함께 보여 주고, 종료된 책에는 `다 읽은 책` 표시를 붙인다. 보관된 책 대화는 책방 목록과 마찬가지로 제외하며, 별점 남기기·수정은 서버가 허용하는 보관되지 않은 책에만 보인다. `entities/book-rating/bookRating.ts`가 이 도메인 접근을 담당하고, `features/book-rating`이 별점 작성 UI를 제공한다. 모바일 책 대화에도 평균과 멤버 별점을 보여 주는 `별점` 시트가 있다.

웹 책 대화 입력창 옆 `+` 메뉴의 `사진에서 문장 가져오기`는 책 페이지 사진을 고르면 브라우저에서 긴 변 2000px JPEG로 줄여 `ocr-page` Edge Function(네이버 CLOVA OCR General V2, 한국 리전)으로 줄 단위 글자와 위치를 받는다. CLOVA 응답에 JPEG 크기가 없어 서버가 JPEG 헤더에서 가로·세로를 읽어 줄 박스를 0~1 비율로 바꾼다. 사진 위 줄 박스를 탭하거나 끌어서(또는 아래 줄 목록에서) 고르고, 확인 화면에서 문장(최대 300자)을 고친 뒤 쪽을 적으면 입력창 끝에 `「인용」` 형식으로 넣고 페이지 라벨을 채운다. 사진·인식 결과는 저장하지 않으며 사용자별 하루 20회까지 쓸 수 있다. 줄 묶기·문장 정리 규칙은 `packages/domain`의 `ocrLayout.ts`·`ocrQuote.ts`, 화면은 `features/photo-quote`에 있다. 모바일은 아직 지원하지 않는다.

서버는 `book_chat_ratings` 테이블과 `upsert_book_chat_rating`·`remove_book_chat_rating` RPC가 담당한다. 기존 완독·진행률 데이터는 별점이 있던 행만 `book_chat_ratings`로 옮기고, 별점이 없던 완독 행과 진행률 테이블은 백업 없이 삭제했다(되돌릴 수 없음). GA4 이벤트는 `book_completed`에서 `book_rated`로 바뀌었다. 개인 기록은 책방의 공동 대화와 연결되지만 사용자별 상태이므로, 화면 상태와 서버 저장 모델을 혼동하지 않는다. 관련 화면 변경은 [테스트](./testing.md)의 `book-rating`·프로필·책 대화 테스트를 확인한다.

## 5. 책방과 책 대화 관리

책방 역할은 방장(`owner`)·운영자(`manager`)·멤버(`member`) 세 가지다. 방장과 운영자는 `/rooms/:roomId/manage`에서 초대 코드를 만들고, 방장만 `/rooms/:roomId/manage/settings`의 설정, 멤버 내보내기, 방장 이양, 역할 변경(`update_room_member_role`), 책방 보관·삭제를 다룬다. 멤버 목록은 역할을 「방장」「운영자」「멤버」로 표시한다. 역할 변경 화면은 3단계 「방 정보」 허브에서 추가한다. 개별 책 대화의 관리 화면은 `/rooms/:roomId/books/:bookChatId/manage`다. 멤버 프로필은 `/rooms/:roomId/members/:profileId`에서 볼 수 있다.

역할 권한은 화면 버튼만으로 보호하지 않는다. 콘텐츠 권한(초대 생성·폐기, 책 대화 상태 변경)은 `private.can_manage_room_content`, 방장 전용 권한은 `private.is_room_owner`와 각 RPC가 확인한다. 오픈 책방 자유 채팅에서는 방장이 방장 외 멤버를, 운영자가 참여자만 「퇴장·차단」할 수 있다. 관리 화면을 고칠 때는 UI 조건뿐 아니라 [보안과 운영](./security-operations.md)의 RPC 권한 계약과 pgTAP 검증을 갱신한다.

## 6. 영상, 알림, 지원 흐름

- 책 대화의 영상 archive와 player는 `/rooms/:roomId/books/:bookChatId/videos` 및 그 하위 경로에서 제공하며 lazy load한다.
- `/notifications`는 앱 내 알림을, `/profile` 및 하위 경로는 프로필·설정·계정 삭제 흐름을 제공한다.
- 앱 전역 피드백 시작점은 `AppNavigationLayout`에 있고, 문의 화면은 `/contact`다. 관리자 피드백 화면은 별도의 `AdminRoute`로 보호된다.

영상 업로드·재생과 계정 삭제는 Mux·Edge Function·삭제 worker를 경유한다. 사용자 흐름을 설명하는 화면과 달리 실제 권한·물리 삭제·장애 대응은 [보안과 운영](./security-operations.md)에 한 번만 정리한다.

## 변경 시 확인

- 용어를 추가·수정할 때는 제품 화면에 책방·책 대화·독후감을 사용하고 기술 식별자를 노출하지 않는다. 이 구분은 최근 `5eda370`의 복사 정리와도 일치한다.
- 새 사용자 분기에는 로딩·빈 상태·오류·재시도·키보드 focus·aria label을 함께 고려한다(`AGENTS.md`).
- 흐름 변경은 [아키텍처](./architecture.md)의 route/guard 및 [테스트](./testing.md)의 최소 검증 범위를 함께 검토한다.
