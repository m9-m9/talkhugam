# 2단계: 운영자 역할 (talk-109) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 책방 역할에 `manager`(화면 표시 「운영자」)를 추가하고, 초대·초대 요청·책 대화 추가와 보관·오픈 책방 제재를 방장과 운영자에게 허용하는 권한 규칙을 DB와 웹·모바일 도메인 계층에 반영한다.

**Architecture:** 권한은 PostgreSQL RPC와 RLS에서만 최종 판단한다. 새 helper `private.can_manage_room_content`가 「활성 방장 또는 운영자」 규칙을 한곳에 모으고, 각 RPC는 마이그레이션 이력의 **최신 정의**를 그대로 옮긴 뒤 역할 검사만 바꾼다. 웹·모바일은 `@talkhugam/domain`의 순수 helper(`roomPermission.ts`)로 버튼 노출만 맞추고, 역할 변경 화면과 「방 정보」 허브는 3단계로 넘긴다.

**Tech Stack:** Supabase PostgreSQL (plpgsql RPC, RLS, pgTAP), Zod 4, TypeScript strict, React 19 + TanStack Query + `@seed-design/react`(웹), Expo/React Native(모바일), Vitest, Jest(모바일 화면), Playwright.

**작업 위치:** worktree `/Users/jmg/Desktop/talkhugam-talk-109`, 브랜치 `feat/talk-109-room-manager-role`(origin/main 기준, 1단계 #106 포함). 참고용 옛 구현은 `git show feat/talk-103-room-experience:<path>`로만 읽고 병합하지 않는다.

## 결정 사항 (이 계획에서 정한 기본값)

| 항목 | 결정 | 이유 |
| --- | --- | --- |
| 역할 변경 RPC 인자 이름 | `p_member_id` (로드맵 계약 그대로) | 계약이 이름을 고정했다. 기존 `remove_room_member`의 `p_target_member_id`와 다르지만 3단계 UI가 계약 이름을 쓴다. |
| 역할 변경 알림 | **만들지 않는다** | `notify_room_member_change` trigger는 방장 이양·내보내기만 다룬다. 알림 종류를 늘리려면 enum 값 추가(별도 마이그레이션), 웹·모바일·푸시 문구가 함께 필요하고, 역할 변경 화면은 3단계다. 3단계에서 「운영자 지정 알림」을 별도 결정한다. |
| 역할 변경 오류 순서 | 호출자가 활성 방장이 아니면 `ROOM_FORBIDDEN` → `p_role`이 `null`·`owner`면 `VALIDATION_FAILED` → 대상이 활성·비방장·탈퇴 전 멤버가 아니면 `ROOM_FORBIDDEN` | 기존 `remove_room_member`와 같은 오류 코드 체계. |
| 역할 변경 대상 책방 | 비공개·오픈 책방 모두, 단 `status = 'active'`이고 삭제되지 않은 책방만 | 결정 사항 「운영자 역할: 비공개 책방과 오픈 책방 모두」. |
| 운영자 수 제한 | 두지 않는다 | 비공개 책방은 최대 6명이라 실익이 없고, 오픈 책방은 운영 판단에 맡긴다. |
| 현재 역할 조회 | 새 RPC `public.get_my_room_role(p_room_id uuid) returns public.member_role` | 웹 책방 상세·모바일 책방 상세가 프로필 id 조회 없이 같은 규칙으로 역할을 읽는다. 활성 멤버가 아니면 `null`. |
| 초대 요청(#100) | 승인·거절 RPC는 **존재하지 않는다**. `request_room_invite`는 「참여자가 방장에게 초대 코드를 만들어 달라고 알림을 보내는」 RPC다. 운영자도 초대를 만들 수 있으므로 **방장과 활성 운영자 모두에게** `invite_request` 알림을 보내고, 운영자 자신은 요청할 수 없다(`ROOM_MANAGER_CANNOT_REQUEST_INVITE`). | 알림 이동 경로 `/rooms/:roomId/manage`에서 운영자도 초대 코드를 만들 수 있게 되므로 수신자를 넓히는 것이 자연스럽다. 반환값은 「새 알림이 한 건이라도 생겼는지」. |
| 초대 목록 RLS | `room_invites_select_owner` 정책을 `room_invites_select_room_content_manager`(방장·운영자)로 교체 | 초대 폐기는 목록 조회가 전제다. |
| 책 대화 상태 변경 | `set_book_chat_status`: 지금은 **모든 활성 멤버**가 가능 → 방장·운영자로 **좁힌다** | 로드맵 계약. 현재 웹·모바일 화면에서 이 RPC를 호출하는 곳은 없다(`updateBookChatStatus` 미사용). |
| 책 대화 추가 | `create_book_chat`: 지금은 **모든 활성 멤버**가 가능 → 방장·운영자로 **좁힌다**(Task 6, 독립 태스크) | 로드맵 계약과 4단계 「제안하기」 흐름의 전제. 참여자는 4단계 전까지 책을 추가할 수 없다(아래 「열린 질문」). 오픈 책방에도 같은 함수가 적용된다(현재 오픈 책방에는 책 대화 화면이 없지만 DB는 막지 않으므로 같은 규칙). |
| 책 대화 삭제·복원 | `delete_book_chat`·`restore_book_chat`은 **바꾸지 않는다**(방장 또는 그 책 대화를 만든 멤버) | 계약 범위는 「추가·보관」이다. 삭제는 영상 자원 삭제 작업까지 만드는 비가역 동작이므로 운영자에게 넓히지 않는다. 운영자가 직접 만든 책 대화는 만든 사람 규칙으로 이미 삭제할 수 있다. |
| 영상 게시물 삭제 | `delete_video_post`는 바꾸지 않는다(작성자 또는 방장) | 게시물 중재는 계약 범위 밖. 도메인 `canDeleteVideoPost`도 방장만 유지. |
| 방장 이양 대상 | 운영자에게도 이양할 수 있고, 이전 방장은 `member`가 된다(기존 함수 그대로) | 별도 변경 없이 올바르게 동작함을 pgTAP으로 고정한다. |
| 오픈 책방 제재 | 방장: 방장 외 누구나(운영자 포함). 운영자: `member`만. 참여자·외부: 불가 | 계약. |
| 오픈 책방 조회 RPC | `get_community_room`에 `current_member_role`, `list_community_messages`에 `sender_role` 컬럼 추가(반환 형태가 바뀌므로 `drop function` 후 재생성, `is_owner`는 유지) | 운영자 화면이 방장·다른 운영자 메시지에 「퇴장·차단」을 보여 주지 않으려면 보낸 사람 역할이 필요하다. |
| 책 대화 직접 INSERT trigger | 만들지 않는다 | talk-103은 trigger를 뒀지만 `book_chats`는 `authenticated`에 INSERT 권한이 없어(`20260716001100`) RPC만 막으면 충분하다. |
| 표시 이름 | `owner` 「방장」, `manager` 「운영자」, `member` 「멤버」(기존 방 관리 화면 표기 유지) | 사용자 요청. |

## 열린 질문 처리 (2026-10-26 컨트롤러 결정)

1. **참여자의 책 추가 공백:** 4단계 전까지 참여자가 책을 추가할 수 없는 공백을 피하려고 **Task 6은 이번 단계에서 실행하지 않고 4단계(책 제안 요청) PR로 옮긴다.** 위 결정 표의 「책 대화 추가」 행과 `20261027000500` 파일은 4단계에서 적용한다. 2단계 문서·PR에서도 책 추가 권한은 「모든 활성 멤버(변경 없음)」로 적는다.
2. **「운영자」 용어 겹침:** 역할 이름은 「운영자」로 두고 신고 문구는 손대지 않는다.

## Global Constraints

로드맵(`2026-10-26-room-experience-rebuild.md`)의 Global Constraints를 그대로 옮긴다.

- 시작 조건: PR #105(talk-106 모바일)가 main에 병합된 뒤 각 단계 브랜치를 최신 main에서 만든다.
- 브랜치 `<type>/talk-<번호>-<영문>`, 커밋·PR 제목 `<type>(<scope>): <한글 요약>`, PR 본문 한글, Squash and merge.
- 모든 함수·컴포넌트 바로 위에 책임을 설명하는 한글 JSDoc(`pnpm docs:functions:web`).
- 함수 제어 흐름 depth 2 이하, 순수 로직과 부수 효과 분리.
- 320px 최소 폭, 640px 중앙 캔버스. 다크 테마 토큰(`design.md`, `globals.css`)만 사용하고 코랄은 쓰지 않는다.
- 마이그레이션 파일명은 작업일 기준 `YYYYMMDDHHMMSS`로 새로 만든다. 기존 마이그레이션 파일은 수정하지 않는다.
- `returns table`의 컬럼명과 같은 테이블 컬럼은 함수 본문에서 반드시 `테이블명.컬럼`으로 한정한다(#105에서 발견한 `join_community_room` 버그 재발 방지).
- pgTAP에서 `smallint` 인자는 `::smallint`로 명시한다.
- 사용자 흐름이 바뀌면 같은 PR에서 `openwiki/product-flows.md`와 Product Hub 문안을 갱신한다.
- 완료 전 실행: `pnpm format:web`, `pnpm lint:web`, `pnpm typecheck:web`, `pnpm docs:functions:web`, `pnpm test:web`, `pnpm build:web`, `pnpm typecheck:mobile`, `pnpm test:mobile`, `pnpm --filter @talkhugam/domain test`. DB·Playwright는 CI 결과로 확인한다.

2단계 추가 제약:

- 마이그레이션 파일은 `20261027000100`부터 순서대로 쓴다: `…000100`(enum), `…000200`(T1), `…000300`(T2), `…000400`(T3), `…000500`(T6). enum 값 추가 파일과 그 값을 쓰는 파일은 반드시 분리한다(같은 트랜잭션에서 새 enum 값을 쓸 수 없다. 선례: `20260722000100` → `20260722000200`).
- 재정의하는 함수는 아래 「재정의 대상과 최신 정의 위치」의 파일에서 본문을 복사해 시작하고, 표에 적은 줄만 바꾼다. 다른 동작(입력 검증·오류 코드·잠금)은 유지한다.
- 재정의·신규 함수마다 `comment on function`을 한글로 다시 적는다(`145_function_comments`가 한글 설명을 검사한다). `drop function` 후 재생성한 함수는 `revoke`/`grant`도 다시 적는다.
- 함수·테이블을 추가하면 `supabase/tests/database/145_function_comments.test.sql`의 목록 두 곳과 개수(현재 70)를, `authenticated`에 실행 권한을 주는 `private` 함수를 추가하면 `130_rls_audit.test.sql`의 allowlist를 같은 커밋에서 갱신한다.
- pgTAP은 로컬 Supabase가 없어 CI(「백엔드 CI / 데이터베이스 migration과 RLS 검사」, `pull_request` → `main`에서만 실행)로만 확인한다. Task 1에서 draft PR을 먼저 열어 이후 push마다 CI가 돌게 한다. `gh`는 항상 `GH_CONFIG_DIR=$HOME/.config/gh-talkhugam gh …`로 실행한다.
- pgTAP fixture는 `\ir ../helpers/auth.inc`, `tests.create_supabase_user`, `tests.authenticate_as` + `set local role authenticated` / `reset role` 패턴을 쓴다. 역할을 바꾸기 전에는 반드시 `reset role`부터 한다. `authenticated` 역할에서는 임시 테이블을 만들지 않는다.
- Zod 4의 `.uuid()`는 버전·variant 비트를 검사한다. 도메인·entity 테스트 fixture UUID는 `xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx` 형태(예: `f17c0d6d-3e6e-4b7f-a1f1-5d652aa2a85e`)만 쓴다. `00000000-0000-0000-0000-…`는 Zod를 거치지 않는 페이지 mock에서만 쓴다.
- 방장 전용으로 남는 동작: 책방 설정(`reading_rooms_update_owner` 정책, `RoomSettingsPage`), 멤버 내보내기(`remove_room_member`), 방장 이양(`transfer_room_ownership`), 책방 삭제·복원(`delete_reading_room`·`restore_reading_room`), 마지막 방장의 보관·삭제(`leave_room`), 역할 변경(`update_room_member_role`). 이 목록의 화면 버튼도 방장에게만 보인다.

## 기존 `owner`/`member` 가정 감사표

`grep -n "'owner'\|'member'\|is_room_owner\|role =\|role <>\|role in" supabase/migrations/*.sql`와 웹·모바일·도메인 grep 결과 전체를 검토했다. 「변경」은 이 계획의 태스크 번호다.

| 위치 (최신 정의 파일) | 현재 가정 | `manager`가 있을 때 | 결정 |
| --- | --- | --- | --- |
| `member_role` enum (`20260716000400`) | `owner`, `member` | — | `manager` 추가 (T1, `20261027000100`) |
| `room_members_inactive_owner_forbidden` check: `status = 'active' or role = 'member'` | 비활성 행은 `member`만 | 비활성 운영자 행은 거부된다 | 변경 없음. 비활성화 경로 4곳(`leave_room`, `remove_room_member`, `ban_community_member`, `prepare_account_deletion`)이 모두 `role = 'member'`로 되돌린다. T1 테스트로 `leave_room`·`prepare_account_deletion`을 고정 |
| `room_members_one_active_owner` unique index | 활성 방장 1명 | 영향 없음 | 변경 없음 |
| `private.is_room_owner` (`20260716000500`) | 방장만 | 방장만 | 변경 없음(방장 전용 동작이 계속 사용) |
| `reading_rooms_update_owner` 정책 (`20260716000500`) | 방장만 설정 수정 | 운영자 거부 | 변경 없음. T1 테스트로 운영자 거부 고정 |
| `room_invites_select_owner` 정책 (`20260716000800`) | 방장만 초대 조회 | 운영자도 필요 | 교체 (T2) |
| `create_reading_room`·`create_community_room` | 생성자를 `owner`로 넣음 | 영향 없음 | 변경 없음 |
| `transfer_room_ownership` (`20260716000600`) | 이전 방장 → `member`, 대상 → `owner` | 운영자에게 이양 가능 | 변경 없음. T1 테스트로 고정 |
| `leave_room` (`20260716000600`) | `owner`만 특수 처리, 나가면 `member` | 운영자는 일반 멤버처럼 나감 | 변경 없음. T1 테스트로 고정 |
| `remove_room_member` (`20260718000500`) | 방장만, 대상이 방장이면 거부 | 방장은 운영자도 내보낼 수 있음, 운영자는 호출 불가 | 변경 없음. T1 테스트로 운영자 거부 고정 |
| `create_room_invite` (`20260818000500`) | `is_room_owner` + `role = 'owner'`로 생성자 id 조회 | 운영자 허용 필요 | 변경 (T2) |
| `revoke_room_invite` (`20260716000800`) | `is_room_owner` | 운영자 허용 필요 | 변경 (T2) |
| `join_room_by_invite` (`20260716000800`)·`join_community_room` (`20261026000100`) | 재참여 시 `role = 'member'` | 나갔던 운영자는 일반 멤버로 돌아옴 | 변경 없음(의도된 동작) |
| `request_room_invite` (`20260722000200`) | 방장 1명에게만 알림, 방장은 요청 불가 | 운영자도 초대 가능 | 변경 (T2): 수신자 방장+운영자, 운영자 요청 거부 |
| `set_book_chat_status` (`20260716001100`) | 모든 활성 멤버 | 방장·운영자로 좁힘 | 변경 (T2) |
| `create_book_chat` (`20260716001100`) | 모든 활성 멤버 | 방장·운영자로 좁힘 | 변경 (T6) |
| `delete_book_chat`·`restore_book_chat` (`20260716002200`) | 방장 또는 생성자 | — | 변경 없음(결정 사항) |
| `delete_reading_room`·`restore_reading_room` (`20260716002200`) | 방장만 | 운영자 거부 | 변경 없음. T1 테스트로 `delete_reading_room` 거부 고정 |
| `delete_video_post` (`20260717000200`) | 작성자 또는 방장 | — | 변경 없음(결정 사항) |
| `private.notify_room_member_change` (`20260716001500`) | `new.role = 'owner'`일 때만 이양 알림 | 운영자 지정·해제는 알림 없음 | 변경 없음(결정 사항). T1 테스트로 「알림 없음」 고정 |
| `prepare_account_deletion` (`20260716002100`) | 활성 방장이고 다른 멤버가 있으면 거부, 모든 멤버 행을 `member`·`left`로 | 운영자는 막히지 않고 `member`로 비활성화 | 변경 없음. T1 테스트로 고정 |
| `ban_community_member` (`20260818000500`) | 방장만 | 운영자 허용(대상 제한) | 변경 (T3) |
| `get_community_room` (`20260818000600`) | `is_owner`만 반환 | 운영자 여부를 알 수 없음 | 변경 (T3): `current_member_role` 추가 |
| `list_community_messages` (`20260818000600`) | 보낸 사람 역할 없음 | 제재 버튼 판단 불가 | 변경 (T3): `sender_role` 추가 |
| `get_my_reading_room_summaries`·`get_my_archived_reading_rooms`·`shares_active_room`·`is_active_room_member`·`current_room_member_id`·`private.enqueue_book_chat_activity_notifications` | 역할 미사용 | 영향 없음 | 변경 없음 |
| 푸시 대기열 trigger (`20260818000300`) | `invite_request` 알림을 수신자별로 대기열에 넣음 | 운영자 수신분도 자동 푸시 | 변경 없음 |
| Edge Function(`supabase/functions`)·통합 테스트(`supabase/tests/integration`) | 방장이 `create_book_chat` 호출 | 영향 없음 | 변경 없음 |
| `packages/domain/src/video.ts` `currentRoomMemberRowSchema` | `z.enum(['owner','member'])` | `manager` 행에서 **parse 오류** | 변경 (T4) |
| `apps/web/src/entities/room-management/roomManagement.ts` 멤버 schema·타입 | `z.enum(['owner','member'])` | 방 관리·책 대화 화면 전체가 **parse 오류** | 변경 (T4) |
| `apps/web/src/entities/community/community.ts`, `apps/mobile/src/entities/community/mobileCommunity.ts` | `is_owner`만 사용 | 운영자 제재 버튼 없음 | 변경 (T4, T5) |
| `RoomManagementPage` 역할 표기·초대 버튼 | `role === 'owner' ? '방장' : '멤버'`, 초대는 방장만 | 운영자가 「멤버」로 보이고 초대 불가 | 변경 (T5) |
| `BookDiscussionPage` `+` 메뉴 | 방장만 「책방 초대하기」 | 운영자에게도 필요 | 변경 (T5) |
| `CommunityRoomDetailPage`·`MobileCommunityRoomDetailScreen` 제재 버튼 | `isOwner`만 | 운영자 허용(대상 제한) | 변경 (T5) |
| `RoomDetailPage` 「새 책」, `MobileRoomDetailScreen` 「새 책 대화 시작」 | 모든 멤버에게 표시 | 참여자는 서버에서 거부 | 변경 (T6) |
| `RoomSettingsPage`, 방 관리의 「방 설정」·멤버 메뉴(이양·내보내기)·「방 보관하고 나가기」 | 방장만 | 방장만 | 변경 없음(「방 설정」 버튼만 T5에서 방장 조건으로 분리) |
| 알림 문구(`notification.ts`, `mobileNotification.ts`), 계정 설정 「방장인 책방은…」, 법적 문서 | 방장 표현 | 영향 없음 | 변경 없음 |

## 재정의 대상과 최신 정의 위치

| 함수·정책 | 최신 정의 파일 | 바꾸는 부분 | 태스크 |
| --- | --- | --- | --- |
| `public.create_room_invite(uuid, interval, smallint)` | `supabase/migrations/20260818000500_create_community_rooms.sql` | `is_room_owner` → `can_manage_room_content`, 생성자 id를 `current_room_member_id`로 조회. 비공개 책방 전용 검사는 유지 | T2 |
| `public.revoke_room_invite(uuid)` | `supabase/migrations/20260716000800_create_invite_rpcs.sql` | `is_room_owner` → `can_manage_room_content` | T2 |
| 정책 `room_invites_select_owner` | `supabase/migrations/20260716000800_create_invite_rpcs.sql` | drop 후 `room_invites_select_room_content_manager` 생성 | T2 |
| `public.request_room_invite(uuid)` | `supabase/migrations/20260722000200_create_room_invite_request_rpc.sql` | 운영자 요청 거부, 수신자 방장+운영자 | T2 |
| `public.set_book_chat_status(uuid, book_chat_status)` | `supabase/migrations/20260716001100_secure_books_and_chats.sql` | `is_active_room_member` → `can_manage_room_content` | T2 |
| `public.ban_community_member(uuid, uuid)` | `supabase/migrations/20260818000500_create_community_rooms.sql` | 호출자 역할 `owner`·`manager`, 운영자는 `member`만 제재 | T3 |
| `public.get_community_room(uuid)` | `supabase/migrations/20260818000600_add_community_read_rpcs.sql` | drop + 재생성, `current_member_role` 추가 | T3 |
| `public.list_community_messages(uuid, integer)` | `supabase/migrations/20260818000600_add_community_read_rpcs.sql` | drop + 재생성, `sender_role` 추가 | T3 |
| `public.create_book_chat(uuid, book_source, text, text, text[], text, text, text, date, text, text)` | `supabase/migrations/20260716001100_secure_books_and_chats.sql` | 멤버 조회에 `member.role in ('owner','manager')` 추가 | T6 |

신규: `private.can_manage_room_content(uuid)`, `public.update_room_member_role(uuid, uuid, member_role)`, `public.get_my_room_role(uuid)` (T1).

## 파일 구조

**DB**
- Create: `supabase/migrations/20261027000100_add_room_manager_role.sql` — enum 값만 (T1)
- Create: `supabase/migrations/20261027000200_add_room_manager_permissions.sql` — helper, 역할 변경, 내 역할 조회 (T1)
- Create: `supabase/migrations/20261027000300_widen_private_room_manager_permissions.sql` — 초대·초대 요청·책 대화 상태·초대 RLS (T2)
- Create: `supabase/migrations/20261027000400_add_community_manager_moderation.sql` — 오픈 책방 제재·조회 RPC (T3)
- Create: `supabase/migrations/20261027000500_restrict_book_chat_creation_to_managers.sql` — 책 대화 추가 (T6)
- Create: `supabase/tests/database/235_room_manager_role.test.sql` (T1)
- Create: `supabase/tests/database/240_room_manager_private_permissions.test.sql` (T2)
- Create: `supabase/tests/database/250_room_manager_community_moderation.test.sql` (T3)
- Create: `supabase/tests/database/245_room_manager_book_chat_creation.test.sql` (T6)
- Modify: `supabase/tests/database/130_rls_audit.test.sql` (T1), `145_function_comments.test.sql` (T1), `225_community_read_rpcs.test.sql` (T3)

**공용 도메인**
- Create: `packages/domain/src/roomPermission.ts`, `packages/domain/src/roomPermission.test.ts` (T4)
- Modify: `packages/domain/src/index.ts`, `packages/domain/src/video.ts`, `packages/domain/src/video.test.ts` (T4)

**웹**
- Modify: `apps/web/src/entities/room-management/roomManagement.ts`, `roomManagement.test.ts` (T4), `index.ts` (T6)
- Modify: `apps/web/src/entities/community/community.ts`, `community.test.ts` (T4)
- Modify: `apps/web/src/pages/rooms/RoomManagementPage.tsx`, `RoomManagementPage.test.tsx`, `BookDiscussionPage.tsx`, `BookDiscussionPage.test.tsx` (T5)
- Modify: `apps/web/src/pages/community/CommunityRoomDetailPage.tsx`; Create: `CommunityRoomDetailPage.test.tsx` (T5)
- Modify: `apps/web/src/pages/rooms/RoomDetailPage.tsx`, `RoomDetailPage.test.tsx`, `apps/web/e2e/ui-health.spec.ts` (T6)

**모바일**
- Modify: `apps/mobile/src/entities/community/mobileCommunity.ts`, `mobileCommunity.test.ts` (T4)
- Modify: `apps/mobile/src/features/community/MobileCommunityEntryScreens.tsx`; Create: `apps/mobile/tests/MobileCommunityRoomDetailScreen.test.tsx` (T5)
- Modify: `apps/mobile/src/entities/reading-room/mobileRoomDetail.ts`, `mobileRoomDetail.test.ts`, `index.ts`, `apps/mobile/src/features/reading-room/MobileRoomDetailScreen.tsx`, `apps/mobile/tests/RoomDetailScreen.test.tsx` (T6)

**문서**
- Modify: `openwiki/product-flows.md`, `openwiki/security-operations.md`, `docs/superpowers/plans/2026-10-26-room-experience-rebuild.md`(로드맵 표의 2단계 「상세 계획」 칸) (T7)

---

### Task 1: `manager` enum, 권한 helper, 역할 변경·내 역할 조회 RPC

**Files:**
- Create: `supabase/migrations/20261027000100_add_room_manager_role.sql`
- Create: `supabase/migrations/20261027000200_add_room_manager_permissions.sql`
- Create: `supabase/tests/database/235_room_manager_role.test.sql`
- Modify: `supabase/tests/database/130_rls_audit.test.sql` (private allowlist)
- Modify: `supabase/tests/database/145_function_comments.test.sql` (목록 두 곳 + 개수 70 → 73)

**Interfaces:**
- Consumes: 없음
- Produces:
  - enum 값 `public.member_role` = `'owner' | 'manager' | 'member'`
  - `private.can_manage_room_content(p_room_id uuid) returns boolean` — 현재 사용자가 해당 방의 활성 `owner` 또는 `manager`. `authenticated` 실행 가능(RLS 정책에서 사용).
  - `public.update_room_member_role(p_room_id uuid, p_member_id uuid, p_role public.member_role) returns void` — 오류 `AUTH_REQUIRED`, `ROOM_FORBIDDEN`, `VALIDATION_FAILED`
  - `public.get_my_room_role(p_room_id uuid) returns public.member_role` — 활성 멤버가 아니거나 삭제된 책방이면 `null`

- [ ] **Step 1: 실패하는 pgTAP 작성** — `supabase/tests/database/235_room_manager_role.test.sql`

```sql
begin;

\ir ../helpers/auth.inc

select plan(37);

select has_function(
  'public', 'update_room_member_role', array['uuid', 'uuid', 'member_role'],
  '방장 역할 변경 RPC가 존재해야 한다'
);
select has_function(
  'private', 'can_manage_room_content', array['uuid'],
  '콘텐츠 관리 권한 helper가 존재해야 한다'
);
select has_function(
  'public', 'get_my_room_role', array['uuid'],
  '내 책방 역할 조회 RPC가 존재해야 한다'
);
select ok(
  'manager' = any(enum_range(null::public.member_role)::text[]),
  'member_role에 manager 값이 있어야 한다'
);

select tests.create_supabase_user('00000000-0000-0000-0000-000000000351', 'role-owner@test.local', '역할 방장');
select tests.create_supabase_user('00000000-0000-0000-0000-000000000352', 'role-manager@test.local', '역할 운영자');
select tests.create_supabase_user('00000000-0000-0000-0000-000000000353', 'role-member@test.local', '역할 참여자');
select tests.create_supabase_user('00000000-0000-0000-0000-000000000354', 'role-outsider@test.local', '역할 외부');
select tests.create_supabase_user('00000000-0000-0000-0000-000000000355', 'role-former@test.local', '역할 이전 멤버');
select tests.create_supabase_user('00000000-0000-0000-0000-000000000356', 'role-leaving@test.local', '역할 탈퇴 운영자');

insert into public.reading_rooms (id, name, created_by)
values (
  '10000000-0000-0000-0000-000000000351',
  '운영자 역할 테스트 책방',
  '00000000-0000-0000-0000-000000000351'
);

insert into public.room_members (id, room_id, profile_id, role, status, room_display_name, left_at)
values
  ('20000000-0000-0000-0000-000000000351', '10000000-0000-0000-0000-000000000351', '00000000-0000-0000-0000-000000000351', 'owner', 'active', '역할 방장', null),
  ('20000000-0000-0000-0000-000000000352', '10000000-0000-0000-0000-000000000351', '00000000-0000-0000-0000-000000000352', 'member', 'active', '역할 운영자', null),
  ('20000000-0000-0000-0000-000000000353', '10000000-0000-0000-0000-000000000351', '00000000-0000-0000-0000-000000000353', 'member', 'active', '역할 참여자', null),
  ('20000000-0000-0000-0000-000000000355', '10000000-0000-0000-0000-000000000351', '00000000-0000-0000-0000-000000000355', 'member', 'left', '역할 이전 멤버', now()),
  ('20000000-0000-0000-0000-000000000356', '10000000-0000-0000-0000-000000000351', '00000000-0000-0000-0000-000000000356', 'member', 'active', '역할 탈퇴 운영자', null);

-- 방장: 승격과 거부 규칙
select tests.authenticate_as('00000000-0000-0000-0000-000000000351');
set local role authenticated;

select lives_ok(
  $$select public.update_room_member_role('10000000-0000-0000-0000-000000000351', '20000000-0000-0000-0000-000000000352', 'manager')$$,
  '방장은 참여자를 운영자로 바꿀 수 있어야 한다'
);
select throws_ok(
  $$select public.update_room_member_role('10000000-0000-0000-0000-000000000351', '20000000-0000-0000-0000-000000000353', 'owner')$$,
  'P0001', 'VALIDATION_FAILED',
  '역할 변경으로 방장을 넘길 수 없어야 한다'
);
select throws_ok(
  $$select public.update_room_member_role('10000000-0000-0000-0000-000000000351', '20000000-0000-0000-0000-000000000351', 'member')$$,
  'P0001', 'ROOM_FORBIDDEN',
  '방장 자신의 역할은 바꿀 수 없어야 한다'
);
select throws_ok(
  $$select public.update_room_member_role('10000000-0000-0000-0000-000000000351', '20000000-0000-0000-0000-000000000355', 'manager')$$,
  'P0001', 'ROOM_FORBIDDEN',
  '활성 멤버가 아니면 역할을 바꿀 수 없어야 한다'
);
select is(
  public.get_my_room_role('10000000-0000-0000-0000-000000000351'),
  'owner'::public.member_role,
  '방장의 역할 조회 결과는 owner여야 한다'
);

reset role;

select is(
  (select role from public.room_members where id = '20000000-0000-0000-0000-000000000352'),
  'manager'::public.member_role,
  '승격된 멤버는 manager로 저장되어야 한다'
);
select is(
  (select count(*) from public.notifications where recipient_profile_id = '00000000-0000-0000-0000-000000000352'),
  0::bigint,
  '운영자 지정은 알림을 만들지 않아야 한다'
);

-- 운영자: 콘텐츠 권한은 있고 방장 전용 동작은 거부
select tests.authenticate_as('00000000-0000-0000-0000-000000000352');
set local role authenticated;

select is(
  public.get_my_room_role('10000000-0000-0000-0000-000000000351'),
  'manager'::public.member_role,
  '운영자의 역할 조회 결과는 manager여야 한다'
);
select ok(
  private.can_manage_room_content('10000000-0000-0000-0000-000000000351'),
  '운영자는 콘텐츠 관리 권한이 있어야 한다'
);
select throws_ok(
  $$select public.update_room_member_role('10000000-0000-0000-0000-000000000351', '20000000-0000-0000-0000-000000000353', 'manager')$$,
  'P0001', 'ROOM_FORBIDDEN',
  '운영자는 다른 멤버의 역할을 바꿀 수 없어야 한다'
);
select throws_ok(
  $$select public.remove_room_member('10000000-0000-0000-0000-000000000351', '20000000-0000-0000-0000-000000000353')$$,
  'P0001', 'ROOM_FORBIDDEN',
  '운영자는 멤버를 내보낼 수 없어야 한다'
);
select throws_ok(
  $$select public.transfer_room_ownership('10000000-0000-0000-0000-000000000351', '20000000-0000-0000-0000-000000000353')$$,
  'P0001', 'ROOM_FORBIDDEN',
  '운영자는 방장을 넘길 수 없어야 한다'
);
select throws_ok(
  $$select public.delete_reading_room('10000000-0000-0000-0000-000000000351', '운영자 역할 테스트 책방')$$,
  'P0001', 'ROOM_FORBIDDEN',
  '운영자는 책방을 삭제할 수 없어야 한다'
);
select lives_ok(
  $$update public.reading_rooms set name = '운영자가 바꾼 이름' where id = '10000000-0000-0000-0000-000000000351'$$,
  '운영자의 책방 설정 수정 시도는 RLS로 조용히 걸러져야 한다'
);

reset role;

select is(
  (select name::text from public.reading_rooms where id = '10000000-0000-0000-0000-000000000351'),
  '운영자 역할 테스트 책방',
  '운영자는 책방 이름을 바꿀 수 없어야 한다'
);

-- 참여자
select tests.authenticate_as('00000000-0000-0000-0000-000000000353');
set local role authenticated;

select is(
  public.get_my_room_role('10000000-0000-0000-0000-000000000351'),
  'member'::public.member_role,
  '참여자의 역할 조회 결과는 member여야 한다'
);
select ok(
  not private.can_manage_room_content('10000000-0000-0000-0000-000000000351'),
  '참여자는 콘텐츠 관리 권한이 없어야 한다'
);
select throws_ok(
  $$select public.update_room_member_role('10000000-0000-0000-0000-000000000351', '20000000-0000-0000-0000-000000000353', 'manager')$$,
  'P0001', 'ROOM_FORBIDDEN',
  '참여자는 자신을 운영자로 바꿀 수 없어야 한다'
);

reset role;

-- 외부 사용자
select tests.authenticate_as('00000000-0000-0000-0000-000000000354');
set local role authenticated;

select ok(
  public.get_my_room_role('10000000-0000-0000-0000-000000000351') is null,
  '외부 사용자의 역할 조회 결과는 null이어야 한다'
);
select ok(
  not private.can_manage_room_content('10000000-0000-0000-0000-000000000351'),
  '외부 사용자는 콘텐츠 관리 권한이 없어야 한다'
);
select throws_ok(
  $$select public.update_room_member_role('10000000-0000-0000-0000-000000000351', '20000000-0000-0000-0000-000000000353', 'manager')$$,
  'P0001', 'ROOM_FORBIDDEN',
  '외부 사용자는 역할을 바꿀 수 없어야 한다'
);

reset role;

-- 방장: 해제와 재지정
select tests.authenticate_as('00000000-0000-0000-0000-000000000351');
set local role authenticated;

select lives_ok(
  $$select public.update_room_member_role('10000000-0000-0000-0000-000000000351', '20000000-0000-0000-0000-000000000352', 'member')$$,
  '방장은 운영자를 참여자로 되돌릴 수 있어야 한다'
);

reset role;

select is(
  (select role from public.room_members where id = '20000000-0000-0000-0000-000000000352'),
  'member'::public.member_role,
  '되돌린 역할은 member로 저장되어야 한다'
);

select tests.authenticate_as('00000000-0000-0000-0000-000000000351');
set local role authenticated;

select lives_ok(
  $$select public.update_room_member_role('10000000-0000-0000-0000-000000000351', '20000000-0000-0000-0000-000000000352', 'manager')$$,
  '방장은 같은 멤버를 다시 운영자로 지정할 수 있어야 한다'
);
select lives_ok(
  $$select public.update_room_member_role('10000000-0000-0000-0000-000000000351', '20000000-0000-0000-0000-000000000356', 'manager')$$,
  '방장은 여러 명을 운영자로 지정할 수 있어야 한다'
);

reset role;

-- 운영자가 나가면 비활성 check를 지키며 member로 남아야 한다
select tests.authenticate_as('00000000-0000-0000-0000-000000000352');
set local role authenticated;

select lives_ok(
  $$select public.leave_room('10000000-0000-0000-0000-000000000351')$$,
  '운영자는 방장 이양 없이 책방을 나갈 수 있어야 한다'
);

reset role;

select is(
  (select row(role, status)::text from public.room_members where id = '20000000-0000-0000-0000-000000000352'),
  '(member,left)',
  '나간 운영자는 member 역할로 기록되어야 한다'
);

-- 운영자의 계정 삭제 준비
select tests.authenticate_as('00000000-0000-0000-0000-000000000356');
set local role authenticated;

select lives_ok(
  $$select * from public.prepare_account_deletion('anonymize', '60000000-0000-0000-0000-000000000356')$$,
  '운영자는 방장 이양 없이 계정 삭제를 준비할 수 있어야 한다'
);

reset role;

select is(
  (select row(role, status)::text from public.room_members where id = '20000000-0000-0000-0000-000000000356'),
  '(member,left)',
  '계정 삭제를 준비한 운영자는 member 역할로 비활성화되어야 한다'
);

-- 운영자에게 방장 이양
select tests.authenticate_as('00000000-0000-0000-0000-000000000351');
set local role authenticated;

select lives_ok(
  $$select public.update_room_member_role('10000000-0000-0000-0000-000000000351', '20000000-0000-0000-0000-000000000353', 'manager')$$,
  '방장은 이양 전에 참여자를 운영자로 지정할 수 있어야 한다'
);
select lives_ok(
  $$select public.transfer_room_ownership('10000000-0000-0000-0000-000000000351', '20000000-0000-0000-0000-000000000353')$$,
  '방장은 운영자에게 방장을 넘길 수 있어야 한다'
);

reset role;

select is(
  (select role from public.room_members where id = '20000000-0000-0000-0000-000000000353'),
  'owner'::public.member_role,
  '방장을 넘겨받은 운영자는 owner가 되어야 한다'
);
select is(
  (select role from public.room_members where id = '20000000-0000-0000-0000-000000000351'),
  'member'::public.member_role,
  '이전 방장은 member가 되어야 한다'
);

select * from finish();

rollback;
```

- [ ] **Step 2: 실패를 CI에서 확인하기 위해 테스트만 커밋하고 draft PR을 연다**

```bash
cd /Users/jmg/Desktop/talkhugam-talk-109
git add supabase/tests/database/235_room_manager_role.test.sql
git commit -m "test(rooms): 운영자 역할 권한 계약 테스트 추가"
git push -u origin feat/talk-109-room-manager-role
GH_CONFIG_DIR=$HOME/.config/gh-talkhugam gh pr create --draft --base main \
  --title "feat(rooms): 운영자 역할과 권한 규칙 추가" \
  --body "작업 중입니다. 본문은 마지막 태스크에서 \`.github/pull_request_template.md\` 형식으로 채웁니다. TALK-109"
GH_CONFIG_DIR=$HOME/.config/gh-talkhugam gh pr checks --watch
```

Expected: 「백엔드 CI / 데이터베이스 migration과 RLS 검사」가 `235_room_manager_role.test.sql`에서 FAIL(`has_function` 실패, `invalid input value for enum public.member_role: "manager"` 등). 나머지 job은 통과. 다른 테스트 파일이 실패하면 진행하지 말고 원인부터 확인한다.

- [ ] **Step 3: enum 마이그레이션 작성** — `supabase/migrations/20261027000100_add_room_manager_role.sql`

```sql
alter type public.member_role add value if not exists 'manager' after 'owner';
```

- [ ] **Step 4: 권한 마이그레이션 작성** — `supabase/migrations/20261027000200_add_room_manager_permissions.sql`

```sql
create or replace function private.can_manage_room_content(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.room_members
    where room_members.room_id = p_room_id
      and room_members.profile_id = (select auth.uid())
      and room_members.role in ('owner', 'manager')
      and room_members.status = 'active'
  );
$$;

create or replace function public.get_my_room_role(p_room_id uuid)
returns public.member_role
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select member.role
  from public.room_members as member
  join public.reading_rooms as room on room.id = member.room_id
  where member.room_id = p_room_id
    and member.profile_id = (select auth.uid())
    and member.status = 'active'
    and room.deleted_at is null;
$$;

create or replace function public.update_room_member_role(
  p_room_id uuid,
  p_member_id uuid,
  p_role public.member_role
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_owner_member_id uuid;
  v_target_member_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  select member.id
  into v_owner_member_id
  from public.room_members as member
  join public.reading_rooms as room on room.id = member.room_id
  where member.room_id = p_room_id
    and member.profile_id = auth.uid()
    and member.role = 'owner'
    and member.status = 'active'
    and room.status = 'active'
    and room.deleted_at is null
  for update of member;

  if v_owner_member_id is null then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  if p_role is null or p_role not in ('manager', 'member') then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  update public.room_members as target
  set role = p_role
  where target.id = p_member_id
    and target.room_id = p_room_id
    and target.status = 'active'
    and target.role <> 'owner'
    and target.profile_id is not null
  returning target.id into v_target_member_id;

  if v_target_member_id is null then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;
end;
$$;

revoke all on function private.can_manage_room_content(uuid) from public, anon;
revoke all on function public.get_my_room_role(uuid) from public, anon;
revoke all on function public.update_room_member_role(uuid, uuid, public.member_role) from public, anon;

grant execute on function private.can_manage_room_content(uuid) to authenticated;
grant execute on function public.get_my_room_role(uuid) to authenticated;
grant execute on function public.update_room_member_role(uuid, uuid, public.member_role) to authenticated;

comment on function private.can_manage_room_content(uuid)
is '현재 사용자가 해당 책방의 활성 방장 또는 운영자로서 초대·책 대화 같은 콘텐츠를 관리할 수 있는지 판별한다.';
comment on function public.get_my_room_role(uuid)
is '현재 사용자의 활성 책방 역할을 반환하고, 활성 멤버가 아니거나 삭제된 책방이면 null을 반환한다.';
comment on function public.update_room_member_role(uuid, uuid, public.member_role)
is '활성 책방의 방장만 다른 활성 멤버를 운영자 또는 참여자로 바꾼다. 방장 이양은 transfer_room_ownership으로만 처리한다.';
```

- [ ] **Step 5: RLS 감사 allowlist 갱신** — `supabase/tests/database/130_rls_audit.test.sql`

`'authenticated users should execute only the private RLS helper allowlist'` 블록의 목록에 한 줄을 추가한다.

```sql
      and pg_proc.proname not in (
        'is_active_room_member',
        'is_room_owner',
        'can_manage_room_content',
        'current_room_member_id',
        'shares_active_room',
        'can_access_book_chat',
        'can_access_book',
        'can_access_post'
      )
```

- [ ] **Step 6: 함수 설명 테스트 갱신** — `supabase/tests/database/145_function_comments.test.sql`

두 `documented_function_names` 목록 **모두**에 아래 세 줄을 넣는다(`('private.can_access_post'),` 다음과 `('public.update_room_member_profile')` 앞).

```sql
    ('private.can_manage_room_content'),
```

```sql
    ('public.get_my_room_role'),
    ('public.update_room_member_role'),
```

목록 마지막 항목 뒤에는 쉼표가 없어야 하므로, 예를 들어 끝부분을 다음처럼 만든다.

```sql
    ('public.upsert_book_chat_rating'),
    ('public.get_my_room_role'),
    ('public.update_room_member_role'),
    ('public.update_room_member_profile')
```

첫 번째 `is(...)`의 기대값을 바꾼다.

```sql
select is(
  count(distinct function_name),
  73::bigint,
  '모든 애플리케이션 데이터베이스 함수가 존재한다'
)
```

- [ ] **Step 7: 정적 확인**

Run: `cd /Users/jmg/Desktop/talkhugam-talk-109 && grep -c "manager" supabase/migrations/20261027000100_add_room_manager_role.sql && grep -n "can_manage_room_content\|get_my_room_role\|update_room_member_role" supabase/tests/database/145_function_comments.test.sql | wc -l`
Expected: `1`, `6`

- [ ] **Step 8: 커밋하고 CI 통과 확인**

```bash
cd /Users/jmg/Desktop/talkhugam-talk-109
git add supabase/migrations/20261027000100_add_room_manager_role.sql \
  supabase/migrations/20261027000200_add_room_manager_permissions.sql \
  supabase/tests/database/130_rls_audit.test.sql \
  supabase/tests/database/145_function_comments.test.sql
git commit -m "feat(rooms): 운영자 역할과 역할 변경 RPC 추가"
git push
GH_CONFIG_DIR=$HOME/.config/gh-talkhugam gh pr checks --watch
```

Expected: 「데이터베이스 migration과 RLS 검사」 PASS(`235_room_manager_role ... ok`, `130_rls_audit ... ok`, `145_function_comments ... ok`). 실패하면 `GH_CONFIG_DIR=$HOME/.config/gh-talkhugam gh run view --log-failed`로 로그를 읽고 고친다.

---

### Task 2: 비공개 책방 콘텐츠 권한(초대·초대 요청·책 대화 상태)

**Files:**
- Create: `supabase/migrations/20261027000300_widen_private_room_manager_permissions.sql`
- Create: `supabase/tests/database/240_room_manager_private_permissions.test.sql`

**Interfaces:**
- Consumes: `private.can_manage_room_content(uuid) returns boolean`, `private.current_room_member_id(uuid) returns uuid` (기존)
- Produces (시그니처는 그대로, 권한만 변경):
  - `public.create_room_invite(p_room_id uuid, p_expires_in interval default '7 days', p_max_uses smallint default null) returns table (invite_id uuid, code text, token text, expires_at timestamptz)` — 방장·운영자, 비공개 활성 책방만
  - `public.revoke_room_invite(p_invite_id uuid) returns void` — 방장·운영자
  - `public.request_room_invite(p_room_id uuid) returns boolean` — 참여자만, 수신자 방장+운영자, 새 오류 `ROOM_MANAGER_CANNOT_REQUEST_INVITE`
  - `public.set_book_chat_status(p_book_chat_id uuid, p_status public.book_chat_status) returns void` — 방장·운영자
  - 정책 `room_invites_select_room_content_manager` (select, authenticated)

- [ ] **Step 1: 실패하는 pgTAP 작성** — `supabase/tests/database/240_room_manager_private_permissions.test.sql`

```sql
begin;

\ir ../helpers/auth.inc

select plan(23);

select tests.create_supabase_user('00000000-0000-0000-0000-000000000371', 'private-owner@test.local', '비공개 방장');
select tests.create_supabase_user('00000000-0000-0000-0000-000000000372', 'private-manager@test.local', '비공개 운영자');
select tests.create_supabase_user('00000000-0000-0000-0000-000000000373', 'private-member@test.local', '비공개 참여자');
select tests.create_supabase_user('00000000-0000-0000-0000-000000000374', 'private-outsider@test.local', '비공개 외부');

insert into public.reading_rooms (id, name, created_by)
values ('10000000-0000-0000-0000-000000000371', '운영 권한 책방', '00000000-0000-0000-0000-000000000371');

insert into public.reading_rooms (id, name, created_by, room_kind, access, capacity)
values ('10000000-0000-0000-0000-000000000372', '운영 권한 오픈 책방', '00000000-0000-0000-0000-000000000371', 'community', 'public', 10::smallint);

insert into public.room_members (id, room_id, profile_id, role, room_display_name)
values
  ('20000000-0000-0000-0000-000000000371', '10000000-0000-0000-0000-000000000371', '00000000-0000-0000-0000-000000000371', 'owner', '비공개 방장'),
  ('20000000-0000-0000-0000-000000000372', '10000000-0000-0000-0000-000000000371', '00000000-0000-0000-0000-000000000372', 'manager', '비공개 운영자'),
  ('20000000-0000-0000-0000-000000000373', '10000000-0000-0000-0000-000000000371', '00000000-0000-0000-0000-000000000373', 'member', '비공개 참여자'),
  ('20000000-0000-0000-0000-000000000374', '10000000-0000-0000-0000-000000000372', '00000000-0000-0000-0000-000000000371', 'owner', '오픈 방장'),
  ('20000000-0000-0000-0000-000000000375', '10000000-0000-0000-0000-000000000372', '00000000-0000-0000-0000-000000000372', 'manager', '오픈 운영자');

insert into public.books (id, source, title)
values ('40000000-0000-0000-0000-000000000371', 'manual', '운영 권한 책');

insert into public.book_chats (id, room_id, book_id, created_by_member_id, name)
values ('30000000-0000-0000-0000-000000000371', '10000000-0000-0000-0000-000000000371', '40000000-0000-0000-0000-000000000371', '20000000-0000-0000-0000-000000000371', '운영 권한 책');

insert into public.room_invites (id, room_id, created_by_member_id, code_hash, token_hash, expires_at)
values
  ('50000000-0000-0000-0000-000000000371', '10000000-0000-0000-0000-000000000371', '20000000-0000-0000-0000-000000000371', repeat('1', 64), repeat('2', 64), now() + interval '1 day'),
  ('50000000-0000-0000-0000-000000000372', '10000000-0000-0000-0000-000000000371', '20000000-0000-0000-0000-000000000371', repeat('3', 64), repeat('4', 64), now() + interval '1 day');

select is(
  (select array_agg(policyname::text order by policyname) from pg_policies where schemaname = 'public' and tablename = 'room_invites'),
  array['room_invites_select_room_content_manager']::text[],
  '초대 조회 정책은 방장·운영자 기준 하나여야 한다'
);

-- 방장
select tests.authenticate_as('00000000-0000-0000-0000-000000000371');
set local role authenticated;

select lives_ok(
  $$select * from public.create_room_invite('10000000-0000-0000-0000-000000000371', interval '1 day', 1::smallint)$$,
  '방장은 초대 코드를 만들 수 있어야 한다'
);

reset role;

-- 운영자
select tests.authenticate_as('00000000-0000-0000-0000-000000000372');
set local role authenticated;

select lives_ok(
  $$select * from public.create_room_invite('10000000-0000-0000-0000-000000000371', interval '1 day', 1::smallint)$$,
  '운영자는 비공개 책방 초대 코드를 만들 수 있어야 한다'
);
select is(
  (select count(*) from public.room_invites),
  4::bigint,
  '운영자는 책방 초대 목록을 조회할 수 있어야 한다'
);
select lives_ok(
  $$select public.revoke_room_invite('50000000-0000-0000-0000-000000000371')$$,
  '운영자는 초대 코드를 폐기할 수 있어야 한다'
);
select throws_ok(
  $$select public.request_room_invite('10000000-0000-0000-0000-000000000371')$$,
  'P0001', 'ROOM_MANAGER_CANNOT_REQUEST_INVITE',
  '운영자는 초대를 직접 만들 수 있으므로 요청하지 않아야 한다'
);
select lives_ok(
  $$select public.set_book_chat_status('30000000-0000-0000-0000-000000000371', 'archived')$$,
  '운영자는 책 대화를 보관할 수 있어야 한다'
);
select throws_ok(
  $$select * from public.create_room_invite('10000000-0000-0000-0000-000000000372', interval '1 day', 1::smallint)$$,
  'P0001', 'ROOM_FORBIDDEN',
  '오픈 책방에서는 운영자도 초대 코드를 만들 수 없어야 한다'
);

reset role;

select is(
  (select count(*) from public.room_invites where room_id = '10000000-0000-0000-0000-000000000371' and created_by_member_id = '20000000-0000-0000-0000-000000000372'),
  1::bigint,
  '운영자가 만든 초대는 운영자 멤버로 기록되어야 한다'
);
select ok(
  (select revoked_at is not null from public.room_invites where id = '50000000-0000-0000-0000-000000000371'),
  '운영자가 폐기한 초대는 폐기 시각을 가져야 한다'
);
select is(
  (select status from public.book_chats where id = '30000000-0000-0000-0000-000000000371'),
  'archived'::public.book_chat_status,
  '운영자가 보관한 책 대화는 archived여야 한다'
);

-- 참여자
select tests.authenticate_as('00000000-0000-0000-0000-000000000373');
set local role authenticated;

select throws_ok(
  $$select * from public.create_room_invite('10000000-0000-0000-0000-000000000371', interval '1 day', 1::smallint)$$,
  'P0001', 'ROOM_FORBIDDEN',
  '참여자는 초대 코드를 만들 수 없어야 한다'
);
select is(
  (select count(*) from public.room_invites),
  0::bigint,
  '참여자는 초대 목록을 조회할 수 없어야 한다'
);
select throws_ok(
  $$select public.revoke_room_invite('50000000-0000-0000-0000-000000000372')$$,
  'P0001', 'ROOM_FORBIDDEN',
  '참여자는 초대 코드를 폐기할 수 없어야 한다'
);
select throws_ok(
  $$select public.set_book_chat_status('30000000-0000-0000-0000-000000000371', 'reading')$$,
  'P0001', 'ROOM_FORBIDDEN',
  '참여자는 책 대화 상태를 바꿀 수 없어야 한다'
);
select is(
  public.request_room_invite('10000000-0000-0000-0000-000000000371'),
  true,
  '참여자는 초대를 요청할 수 있어야 한다'
);

reset role;

select is(
  (
    select array_agg(recipient_profile_id::text order by recipient_profile_id)
    from public.notifications
    where type = 'invite_request'
      and actor_member_id = '20000000-0000-0000-0000-000000000373'
  ),
  array['00000000-0000-0000-0000-000000000371', '00000000-0000-0000-0000-000000000372']::text[],
  '초대 요청은 방장과 운영자 모두에게 전달되어야 한다'
);

-- 외부 사용자
select tests.authenticate_as('00000000-0000-0000-0000-000000000374');
set local role authenticated;

select throws_ok(
  $$select * from public.create_room_invite('10000000-0000-0000-0000-000000000371', interval '1 day', 1::smallint)$$,
  'P0001', 'ROOM_FORBIDDEN',
  '외부 사용자는 초대 코드를 만들 수 없어야 한다'
);
select throws_ok(
  $$select public.revoke_room_invite('50000000-0000-0000-0000-000000000372')$$,
  'P0001', 'ROOM_FORBIDDEN',
  '외부 사용자는 초대 코드를 폐기할 수 없어야 한다'
);
select throws_ok(
  $$select public.set_book_chat_status('30000000-0000-0000-0000-000000000371', 'reading')$$,
  'P0001', 'ROOM_FORBIDDEN',
  '외부 사용자는 책 대화 상태를 바꿀 수 없어야 한다'
);

reset role;

-- 방장은 기존처럼 모두 할 수 있다
select tests.authenticate_as('00000000-0000-0000-0000-000000000371');
set local role authenticated;

select lives_ok(
  $$select public.set_book_chat_status('30000000-0000-0000-0000-000000000371', 'reading')$$,
  '방장은 보관한 책 대화를 다시 열 수 있어야 한다'
);
select lives_ok(
  $$select public.revoke_room_invite('50000000-0000-0000-0000-000000000372')$$,
  '방장은 초대 코드를 폐기할 수 있어야 한다'
);

reset role;

select is(
  (select status from public.book_chats where id = '30000000-0000-0000-0000-000000000371'),
  'reading'::public.book_chat_status,
  '방장이 다시 연 책 대화는 reading이어야 한다'
);

select * from finish();

rollback;
```

assertion 수: 1(정책) + 1(방장) + 6(운영자) + 3(reset 확인) + 5(참여자) + 1(알림) + 3(외부) + 2(방장) + 1(최종) = 23.

- [ ] **Step 2: (선택) 실패 확인** — 테스트만 커밋해 push하면 CI가 `ROOM_MANAGER_CANNOT_REQUEST_INVITE`·정책 이름 단언에서 FAIL한다. CI 한 번(약 10분)이 아깝다면 건너뛰고 Step 4에서 통과만 확인한다.

- [ ] **Step 3: 마이그레이션 작성** — `supabase/migrations/20261027000300_widen_private_room_manager_permissions.sql`

```sql
drop policy room_invites_select_owner on public.room_invites;

create policy room_invites_select_room_content_manager
on public.room_invites
for select
to authenticated
using (private.can_manage_room_content(room_id));

create or replace function public.create_room_invite(
  p_room_id uuid,
  p_expires_in interval default interval '7 days',
  p_max_uses smallint default null
)
returns table (invite_id uuid, code text, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_member_id uuid;
  v_invite_id uuid;
  v_code text;
  v_token text;
  v_expires_at timestamptz;
begin
  if not private.can_manage_room_content(p_room_id) then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  if not exists (
    select 1 from public.reading_rooms as room
    where room.id = p_room_id and room.room_kind = 'private' and room.status = 'active' and room.deleted_at is null
  ) then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  if p_expires_in <= interval '0 seconds' or p_expires_in > interval '30 days'
    or (p_max_uses is not null and p_max_uses not between 1 and 20)
  then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  v_member_id := private.current_room_member_id(p_room_id);
  v_code := private.generate_invite_code();
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_expires_at := now() + p_expires_in;

  insert into public.room_invites (
    room_id, created_by_member_id, code_hash, token_hash, expires_at, max_uses
  ) values (
    p_room_id, v_member_id, private.hash_invite_value(v_code), private.hash_invite_value(v_token), v_expires_at, p_max_uses
  ) returning room_invites.id into v_invite_id;

  return query select v_invite_id, v_code, v_token, v_expires_at;
end;
$$;

create or replace function public.revoke_room_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_room_id uuid;
begin
  select room_id
  into v_room_id
  from public.room_invites
  where id = p_invite_id
  for update;

  if v_room_id is null then
    raise exception using errcode = 'P0001', message = 'INVITE_INVALID';
  end if;

  if not private.can_manage_room_content(v_room_id) then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  update public.room_invites
  set revoked_at = coalesce(revoked_at, now())
  where id = p_invite_id;
end;
$$;

create or replace function public.request_room_invite(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_requester public.room_members%rowtype;
  v_inserted_count integer;
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  select *
  into v_requester
  from public.room_members
  where room_members.room_id = p_room_id
    and room_members.profile_id = auth.uid()
    and room_members.status = 'active';

  if v_requester.id is null then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  if v_requester.role = 'owner' then
    raise exception using errcode = 'P0001', message = 'ROOM_OWNER_CANNOT_REQUEST_INVITE';
  end if;

  if v_requester.role = 'manager' then
    raise exception using errcode = 'P0001', message = 'ROOM_MANAGER_CANNOT_REQUEST_INVITE';
  end if;

  if not exists (
    select 1
    from public.room_members
    where room_members.room_id = p_room_id
      and room_members.role = 'owner'
      and room_members.status = 'active'
      and room_members.profile_id is not null
  ) then
    raise exception using errcode = 'P0001', message = 'ROOM_OWNER_NOT_FOUND';
  end if;

  insert into public.notifications (recipient_profile_id, actor_member_id, room_id, type)
  select recipient.profile_id, v_requester.id, p_room_id, 'invite_request'::public.notification_type
  from public.room_members as recipient
  where recipient.room_id = p_room_id
    and recipient.role in ('owner', 'manager')
    and recipient.status = 'active'
    and recipient.profile_id is not null
  on conflict (recipient_profile_id, actor_member_id, room_id)
    where type = 'invite_request' and read_at is null
    do nothing;

  get diagnostics v_inserted_count = row_count;
  return v_inserted_count > 0;
end;
$$;

create or replace function public.set_book_chat_status(
  p_book_chat_id uuid,
  p_status public.book_chat_status
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_chat public.book_chats%rowtype;
begin
  select *
  into v_chat
  from public.book_chats
  where id = p_book_chat_id and deleted_at is null
  for update;

  if v_chat.id is null then
    raise exception using errcode = 'P0001', message = 'BOOK_CHAT_NOT_FOUND';
  end if;

  if not private.can_manage_room_content(v_chat.room_id) then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  if p_status = 'deleted' then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  update public.book_chats
  set
    status = p_status,
    completed_at = case
      when p_status = 'completed' then coalesce(completed_at, now())
      when p_status = 'reading' then null
      else completed_at
    end,
    archived_at = case when p_status = 'archived' then now() else null end
  where id = p_book_chat_id;
end;
$$;

comment on function public.create_room_invite(uuid, interval, smallint)
is '활성 비공개 책방의 방장 또는 운영자만 초대 코드를 만들고, 평문 코드와 토큰은 한 번만 반환한다.';
comment on function public.revoke_room_invite(uuid)
is '해당 책방의 방장 또는 운영자만 초대 코드를 즉시 폐기한다.';
comment on function public.request_room_invite(uuid)
is '참여자가 방장과 운영자에게 책방 초대를 요청하고, 수신자별로 읽지 않은 중복 요청을 막는다.';
comment on function public.set_book_chat_status(uuid, public.book_chat_status)
is '방장 또는 운영자만 책 대화를 읽는 중·종료·보관 상태로 바꾼다.';
```

`create_room_invite`·`revoke_room_invite`·`request_room_invite`·`set_book_chat_status`의 `revoke`/`grant`는 `create or replace`에서 유지되므로 다시 쓰지 않는다.

- [ ] **Step 4: 커밋하고 CI 통과 확인**

```bash
cd /Users/jmg/Desktop/talkhugam-talk-109
git add supabase/migrations/20261027000300_widen_private_room_manager_permissions.sql \
  supabase/tests/database/240_room_manager_private_permissions.test.sql
git commit -m "feat(rooms): 운영자에게 초대와 책 대화 보관 권한 부여"
git push
GH_CONFIG_DIR=$HOME/.config/gh-talkhugam gh pr checks --watch
```

Expected: `240_room_manager_private_permissions ... ok`, 기존 `030_room_invites`, `060_books_and_chats`, `205_room_invite_requests` 포함 전체 PASS.

---

### Task 3: 오픈 책방 제재와 조회 RPC의 역할 필드

**Files:**
- Create: `supabase/migrations/20261027000400_add_community_manager_moderation.sql`
- Create: `supabase/tests/database/250_room_manager_community_moderation.test.sql`
- Modify: `supabase/tests/database/225_community_read_rpcs.test.sql` (반환 키 목록)

**Interfaces:**
- Consumes: 없음(역할 비교를 함수 안에서 직접 수행)
- Produces:
  - `public.ban_community_member(p_room_id uuid, p_target_member_id uuid) returns void` — 방장: 방장 외 누구나, 운영자: `member`만
  - `public.get_community_room(p_room_id uuid) returns table (id uuid, name text, description text, access text, capacity smallint, active_member_count bigint, created_by uuid, current_member_id uuid, is_owner boolean, current_member_role public.member_role)`
  - `public.list_community_messages(p_room_id uuid, p_limit integer default 100) returns table (id uuid, body text, created_at timestamptz, sender_member_id uuid, sender_profile_id uuid, sender_display_name text, sender_role public.member_role)`

- [ ] **Step 1: 실패하는 pgTAP 작성** — `supabase/tests/database/250_room_manager_community_moderation.test.sql`

```sql
begin;

\ir ../helpers/auth.inc

select plan(14);

select tests.create_supabase_user('00000000-0000-0000-0000-000000000381', 'open-owner@test.local', '오픈 방장');
select tests.create_supabase_user('00000000-0000-0000-0000-000000000382', 'open-manager-a@test.local', '오픈 운영자 A');
select tests.create_supabase_user('00000000-0000-0000-0000-000000000383', 'open-manager-b@test.local', '오픈 운영자 B');
select tests.create_supabase_user('00000000-0000-0000-0000-000000000384', 'open-member@test.local', '오픈 참여자');
select tests.create_supabase_user('00000000-0000-0000-0000-000000000385', 'open-member-2@test.local', '오픈 참여자 2');
select tests.create_supabase_user('00000000-0000-0000-0000-000000000386', 'open-outsider@test.local', '오픈 외부');

insert into public.reading_rooms (id, name, created_by, room_kind, access, capacity)
values ('10000000-0000-0000-0000-000000000381', '운영자 오픈 책방', '00000000-0000-0000-0000-000000000381', 'community', 'public', 10::smallint);

insert into public.room_members (id, room_id, profile_id, role, room_display_name)
values
  ('20000000-0000-0000-0000-000000000381', '10000000-0000-0000-0000-000000000381', '00000000-0000-0000-0000-000000000381', 'owner', '오픈 방장'),
  ('20000000-0000-0000-0000-000000000382', '10000000-0000-0000-0000-000000000381', '00000000-0000-0000-0000-000000000382', 'manager', '오픈 운영자 A'),
  ('20000000-0000-0000-0000-000000000383', '10000000-0000-0000-0000-000000000381', '00000000-0000-0000-0000-000000000383', 'manager', '오픈 운영자 B'),
  ('20000000-0000-0000-0000-000000000384', '10000000-0000-0000-0000-000000000381', '00000000-0000-0000-0000-000000000384', 'member', '오픈 참여자'),
  ('20000000-0000-0000-0000-000000000385', '10000000-0000-0000-0000-000000000381', '00000000-0000-0000-0000-000000000385', 'member', '오픈 참여자 2');

insert into public.community_messages (room_id, sender_member_id, body)
values
  ('10000000-0000-0000-0000-000000000381', '20000000-0000-0000-0000-000000000381', '방장 공지'),
  ('10000000-0000-0000-0000-000000000381', '20000000-0000-0000-0000-000000000383', '운영자 안내'),
  ('10000000-0000-0000-0000-000000000381', '20000000-0000-0000-0000-000000000384', '참여자 인사');

-- 운영자 A
select tests.authenticate_as('00000000-0000-0000-0000-000000000382');
set local role authenticated;

select is(
  (select current_member_role from public.get_community_room('10000000-0000-0000-0000-000000000381')),
  'manager'::public.member_role,
  '오픈 책방 상세는 현재 멤버의 운영자 역할을 반환해야 한다'
);
select is(
  (select is_owner from public.get_community_room('10000000-0000-0000-0000-000000000381')),
  false,
  '운영자는 is_owner가 false여야 한다'
);
select is(
  (select array_agg(sender_role::text order by sender_role::text) from public.list_community_messages('10000000-0000-0000-0000-000000000381')),
  array['manager', 'member', 'owner']::text[],
  '자유 채팅 목록은 보낸 사람 역할을 반환해야 한다'
);
select throws_ok(
  $$select public.ban_community_member('10000000-0000-0000-0000-000000000381', '20000000-0000-0000-0000-000000000383')$$,
  'P0001', 'ROOM_FORBIDDEN',
  '운영자는 다른 운영자를 제재할 수 없어야 한다'
);
select throws_ok(
  $$select public.ban_community_member('10000000-0000-0000-0000-000000000381', '20000000-0000-0000-0000-000000000381')$$,
  'P0001', 'ROOM_FORBIDDEN',
  '운영자는 방장을 제재할 수 없어야 한다'
);
select throws_ok(
  $$select public.ban_community_member('10000000-0000-0000-0000-000000000381', '20000000-0000-0000-0000-000000000382')$$,
  'P0001', 'ROOM_FORBIDDEN',
  '운영자는 자기 자신을 제재할 수 없어야 한다'
);
select lives_ok(
  $$select public.ban_community_member('10000000-0000-0000-0000-000000000381', '20000000-0000-0000-0000-000000000384')$$,
  '운영자는 참여자를 퇴장·차단할 수 있어야 한다'
);

reset role;

select is(
  (select row(role, status)::text from public.room_members where id = '20000000-0000-0000-0000-000000000384'),
  '(member,removed)',
  '운영자가 제재한 참여자는 removed로 기록되어야 한다'
);
select is(
  (select banned_by_member_id from public.room_bans where room_id = '10000000-0000-0000-0000-000000000381' and profile_id = '00000000-0000-0000-0000-000000000384'),
  '20000000-0000-0000-0000-000000000382'::uuid,
  '제재 기록은 실행한 운영자 멤버를 남겨야 한다'
);

-- 참여자
select tests.authenticate_as('00000000-0000-0000-0000-000000000385');
set local role authenticated;

select throws_ok(
  $$select public.ban_community_member('10000000-0000-0000-0000-000000000381', '20000000-0000-0000-0000-000000000383')$$,
  'P0001', 'ROOM_FORBIDDEN',
  '참여자는 다른 멤버를 제재할 수 없어야 한다'
);

reset role;

-- 외부 사용자
select tests.authenticate_as('00000000-0000-0000-0000-000000000386');
set local role authenticated;

select throws_ok(
  $$select public.ban_community_member('10000000-0000-0000-0000-000000000381', '20000000-0000-0000-0000-000000000385')$$,
  'P0001', 'ROOM_FORBIDDEN',
  '외부 사용자는 오픈 책방 멤버를 제재할 수 없어야 한다'
);

reset role;

-- 방장
select tests.authenticate_as('00000000-0000-0000-0000-000000000381');
set local role authenticated;

select lives_ok(
  $$select public.ban_community_member('10000000-0000-0000-0000-000000000381', '20000000-0000-0000-0000-000000000383')$$,
  '방장은 운영자를 퇴장·차단할 수 있어야 한다'
);
select is(
  (select current_member_role from public.get_community_room('10000000-0000-0000-0000-000000000381')),
  'owner'::public.member_role,
  '방장의 오픈 책방 상세 역할은 owner여야 한다'
);

reset role;

select is(
  (select row(role, status)::text from public.room_members where id = '20000000-0000-0000-0000-000000000383'),
  '(member,removed)',
  '방장이 제재한 운영자는 member 역할로 비활성화되어야 한다'
);

select * from finish();

rollback;
```

- [ ] **Step 2: 기존 조회 RPC 테스트의 키 목록 갱신** — `supabase/tests/database/225_community_read_rpcs.test.sql`

```sql
  array['access', 'active_member_count', 'capacity', 'created_by', 'current_member_id', 'current_member_role', 'description', 'id', 'is_owner', 'name']::text[],
```

- [ ] **Step 3: 마이그레이션 작성** — `supabase/migrations/20261027000400_add_community_manager_moderation.sql`

```sql
create or replace function public.ban_community_member(p_room_id uuid, p_target_member_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor public.room_members%rowtype;
  v_target_member public.room_members%rowtype;
begin
  select member.* into v_actor
  from public.room_members as member
  join public.reading_rooms as room on room.id = member.room_id
  where member.room_id = p_room_id
    and member.profile_id = auth.uid()
    and member.role in ('owner', 'manager')
    and member.status = 'active'
    and room.room_kind = 'community'
    and room.status = 'active'
  for update of member;

  if v_actor.id is null then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  select * into v_target_member
  from public.room_members
  where room_members.id = p_target_member_id
    and room_members.room_id = p_room_id
    and room_members.status = 'active'
    and room_members.profile_id is not null
  for update;

  if v_target_member.id is null or v_target_member.id = v_actor.id or v_target_member.role = 'owner' then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  if v_actor.role = 'manager' and v_target_member.role <> 'member' then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  insert into public.room_bans (room_id, profile_id, banned_by_member_id)
  values (p_room_id, v_target_member.profile_id, v_actor.id)
  on conflict (room_id, profile_id) do nothing;

  update public.room_members
  set role = 'member', status = 'removed', left_at = now()
  where room_members.id = v_target_member.id;
end;
$$;

drop function public.get_community_room(uuid);

create function public.get_community_room(p_room_id uuid)
returns table (
  id uuid,
  name text,
  description text,
  access text,
  capacity smallint,
  active_member_count bigint,
  created_by uuid,
  current_member_id uuid,
  is_owner boolean,
  current_member_role public.member_role
)
language plpgsql stable security definer set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED'; end if;
  if p_room_id is null then raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED'; end if;
  if not private.is_active_room_member(p_room_id) then raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN'; end if;

  return query
  select room.id, room.name::text, room.description::text, room.access, room.capacity,
    (select count(*) from public.room_members as counted_member where counted_member.room_id = room.id and counted_member.status = 'active')::bigint,
    room.created_by, member.id, (member.role = 'owner'), member.role
  from public.reading_rooms as room
  join public.room_members as member on member.room_id = room.id and member.profile_id = auth.uid() and member.status = 'active'
  where room.id = p_room_id and room.room_kind = 'community' and room.status = 'active' and room.deleted_at is null;
end;
$$;

drop function public.list_community_messages(uuid, integer);

create function public.list_community_messages(p_room_id uuid, p_limit integer default 100)
returns table (
  id uuid,
  body text,
  created_at timestamptz,
  sender_member_id uuid,
  sender_profile_id uuid,
  sender_display_name text,
  sender_role public.member_role
)
language plpgsql stable security definer set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED'; end if;
  if p_room_id is null or p_limit is null or p_limit not between 1 and 100 then raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED'; end if;
  if not private.is_active_room_member(p_room_id) then raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN'; end if;
  if not exists (select 1 from public.reading_rooms as room where room.id = p_room_id and room.room_kind = 'community' and room.status = 'active' and room.deleted_at is null) then raise exception using errcode = 'P0001', message = 'ROOM_NOT_FOUND'; end if;

  return query
  select message.id, message.body::text, message.created_at, sender.id, sender.profile_id, sender.room_display_name::text, sender.role
  from public.community_messages as message
  join public.room_members as sender on sender.id = message.sender_member_id
  where message.room_id = p_room_id and message.deleted_at is null
  order by message.created_at desc, message.id desc
  limit p_limit;
end;
$$;

revoke all on function public.get_community_room(uuid) from public, anon;
revoke all on function public.list_community_messages(uuid, integer) from public, anon;
grant execute on function public.get_community_room(uuid) to authenticated;
grant execute on function public.list_community_messages(uuid, integer) to authenticated;

comment on function public.ban_community_member(uuid, uuid)
is '오픈 책방 방장은 방장 외 멤버를, 운영자는 참여자만 퇴장시키고 재입장을 금지한다.';
comment on function public.get_community_room(uuid)
is '활성 오픈 책방 멤버에게만 방 정보와 본인 멤버 식별자·역할을 제한해 조회한다.';
comment on function public.list_community_messages(uuid, integer)
is '활성 오픈 책방 멤버에게만 자유 채팅 표시 필드와 보낸 사람 역할을 최근 순서로 제한해 조회한다.';
```

- [ ] **Step 4: 커밋하고 CI 통과 확인**

```bash
cd /Users/jmg/Desktop/talkhugam-talk-109
git add supabase/migrations/20261027000400_add_community_manager_moderation.sql \
  supabase/tests/database/250_room_manager_community_moderation.test.sql \
  supabase/tests/database/225_community_read_rpcs.test.sql
git commit -m "feat(community): 오픈 책방 운영자 제재 권한 추가"
git push
GH_CONFIG_DIR=$HOME/.config/gh-talkhugam gh pr checks --watch
```

Expected: `250_…`, `225_…`, `220_community_rooms`, `145_function_comments` 모두 PASS(함수 이름 수는 그대로 73).

---

### Task 4: 공용 역할 helper와 웹·모바일 schema 확장

**Files:**
- Create: `packages/domain/src/roomPermission.ts`, `packages/domain/src/roomPermission.test.ts`
- Modify: `packages/domain/src/index.ts`, `packages/domain/src/video.ts:61-64`, `packages/domain/src/video.test.ts`
- Modify: `apps/web/src/entities/room-management/roomManagement.ts`, `roomManagement.test.ts`
- Modify: `apps/web/src/entities/community/community.ts`, `community.test.ts`
- Modify: `apps/mobile/src/entities/community/mobileCommunity.ts`, `mobileCommunity.test.ts`

**Interfaces:**
- Consumes: T1의 `get_my_room_role` 반환값(`'owner' | 'manager' | 'member' | null`), T3의 `current_member_role`·`sender_role`
- Produces (`@talkhugam/domain`):
  - `roomRoleSchema: z.ZodEnum<['owner','manager','member']>`, `type RoomRole = 'owner' | 'manager' | 'member'`
  - `parseRoomRole(value: unknown): RoomRole | null`
  - `canManageRoomContent(role: RoomRole | null): boolean`
  - `canManageRoomMembers(role: RoomRole | null): boolean`
  - `canBanCommunityMember(actorRole: RoomRole | null, targetRole: RoomRole): boolean`
  - `formatRoomRoleLabel(role: RoomRole): string`
  - `roomRoleKeys.mine(roomId: string): readonly ['room-role', string]`
- Produces (웹 entity):
  - `RoomManagement`에 `canCurrentUserManageContent: boolean`, `currentUserRole: RoomRole | null` 추가(`isCurrentUserOwner`는 유지), `RoomManagementMember.role: RoomRole`
  - `CommunityDetail.currentMemberRole: RoomRole`, `CommunityMessage.senderRole: RoomRole`
- Produces (모바일 entity): `MobileCommunityDetail.currentMemberRole: RoomRole`, `MobileCommunityMessage.senderRole: RoomRole`

- [ ] **Step 1: 실패하는 도메인 테스트 작성** — `packages/domain/src/roomPermission.test.ts`

```ts
import { describe, expect, it } from 'vitest'

import {
  canBanCommunityMember,
  canManageRoomContent,
  canManageRoomMembers,
  formatRoomRoleLabel,
  parseRoomRole,
  roomRoleKeys,
} from './roomPermission'

describe('roomPermission', () => {
  it('allows owners and managers to manage invites and book chats', () => {
    expect(canManageRoomContent('owner')).toBe(true)
    expect(canManageRoomContent('manager')).toBe(true)
    expect(canManageRoomContent('member')).toBe(false)
    expect(canManageRoomContent(null)).toBe(false)
  })

  it('reserves member management for the owner', () => {
    expect(canManageRoomMembers('owner')).toBe(true)
    expect(canManageRoomMembers('manager')).toBe(false)
    expect(canManageRoomMembers('member')).toBe(false)
    expect(canManageRoomMembers(null)).toBe(false)
  })

  it('lets a manager ban only regular members in an open bookstore', () => {
    expect(canBanCommunityMember('owner', 'manager')).toBe(true)
    expect(canBanCommunityMember('owner', 'member')).toBe(true)
    expect(canBanCommunityMember('owner', 'owner')).toBe(false)
    expect(canBanCommunityMember('manager', 'member')).toBe(true)
    expect(canBanCommunityMember('manager', 'manager')).toBe(false)
    expect(canBanCommunityMember('manager', 'owner')).toBe(false)
    expect(canBanCommunityMember('member', 'member')).toBe(false)
    expect(canBanCommunityMember(null, 'member')).toBe(false)
  })

  it('labels each role with the product wording', () => {
    expect(formatRoomRoleLabel('owner')).toBe('방장')
    expect(formatRoomRoleLabel('manager')).toBe('운영자')
    expect(formatRoomRoleLabel('member')).toBe('멤버')
  })

  it('parses a server role and keeps null for non-members', () => {
    expect(parseRoomRole('manager')).toBe('manager')
    expect(parseRoomRole(null)).toBeNull()
    expect(() => parseRoomRole('admin')).toThrow()
  })

  it('builds a stable query key per room', () => {
    expect(roomRoleKeys.mine('f17c0d6d-3e6e-4b7f-a1f1-5d652aa2a85e')).toEqual([
      'room-role',
      'f17c0d6d-3e6e-4b7f-a1f1-5d652aa2a85e',
    ])
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @talkhugam/domain exec vitest run src/roomPermission.test.ts`
Expected: FAIL — `Failed to resolve import "./roomPermission"`.

- [ ] **Step 3: 도메인 helper 구현** — `packages/domain/src/roomPermission.ts`

```ts
import { z } from 'zod'

export const roomRoleSchema = z.enum(['owner', 'manager', 'member'])

export type RoomRole = z.infer<typeof roomRoleSchema>

const roomRoleLabels: Record<RoomRole, string> = {
  manager: '운영자',
  member: '멤버',
  owner: '방장',
}

/** 웹과 모바일이 같은 키로 현재 사용자의 책방 역할을 캐시하도록 Query Key를 제공한다. */
export const roomRoleKeys = {
  /** 책방 식별자로 현재 사용자 역할 query key를 만든다. */
  mine: (roomId: string) => ['room-role', roomId] as const,
}

/** 서버가 돌려준 현재 역할 값을 검증하고, 활성 멤버가 아니면 null로 반환한다. */
export function parseRoomRole(value: unknown): RoomRole | null {
  return roomRoleSchema.nullable().parse(value)
}

/** 역할이 초대와 책 대화 추가·보관 같은 콘텐츠 관리 권한을 갖는지 반환한다. */
export function canManageRoomContent(role: RoomRole | null): boolean {
  return role === 'owner' || role === 'manager'
}

/** 역할이 역할 변경·내보내기·방장 이양·책방 설정 같은 구성원 관리 권한을 갖는지 반환한다. */
export function canManageRoomMembers(role: RoomRole | null): boolean {
  return role === 'owner'
}

/** 오픈 책방에서 제재하는 사람과 대상의 역할을 비교해 퇴장·차단 허용 여부를 반환한다. */
export function canBanCommunityMember(actorRole: RoomRole | null, targetRole: RoomRole): boolean {
  if (actorRole === 'owner') return targetRole !== 'owner'
  if (actorRole === 'manager') return targetRole === 'member'
  return false
}

/** 책방 역할을 화면에 보여 줄 한글 이름으로 바꾼다. */
export function formatRoomRoleLabel(role: RoomRole): string {
  return roomRoleLabels[role]
}
```

- [ ] **Step 4: 도메인 공개 경계에 추가** — `packages/domain/src/index.ts` 끝에 추가

```ts
export {
  canBanCommunityMember,
  canManageRoomContent,
  canManageRoomMembers,
  formatRoomRoleLabel,
  parseRoomRole,
  roomRoleKeys,
  roomRoleSchema,
  type RoomRole,
} from './roomPermission'
```

- [ ] **Step 5: 영상 삭제 권한 schema가 운영자 행을 받도록 수정** — `packages/domain/src/video.ts`

파일 상단 import에 추가:

```ts
import { roomRoleSchema } from './roomPermission'
```

`currentRoomMemberRowSchema`를 바꾼다:

```ts
export const currentRoomMemberRowSchema = z.object({
  id: z.string().uuid(),
  role: roomRoleSchema,
})
```

`packages/domain/src/video.test.ts`의 `./video` import 목록에 `parseVideoDeletePermission,`을 추가하고(`parseVideoPlaybackAuthorization,` 앞), `describe('video domain')` 안에 추가:

```ts
  it('accepts a manager row but keeps video deletion for authors and owners', () => {
    expect(
      parseVideoDeletePermission(
        { id: '6a1f0c2e-5b3d-4c7e-9f10-2a3b4c5d6e7f', role: 'manager' },
        '7b2e1d3f-6c4a-4d8b-8a21-3b4c5d6e7f80',
      ),
    ).toEqual({ canDelete: false })
  })
```

- [ ] **Step 6: 도메인 테스트 통과 확인**

Run: `pnpm --filter @talkhugam/domain test`
Expected: PASS(모든 파일).

- [ ] **Step 7: 웹 방 관리 entity 실패 테스트 작성** — `apps/web/src/entities/room-management/roomManagement.test.ts`

첫 번째 테스트(`maps the room and active members…`)의 `toEqual` 기대값에 두 필드를 추가한다:

```ts
    ).toEqual({
      canCurrentUserManageContent: true,
      createdBy: ownerProfileId,
      currentUserRole: 'owner',
      description: '이번 달 함께 읽는 책들',
      id: roomId,
      isCurrentUserOwner: true,
```

같은 `describe('parseRoomManagement')`에 테스트를 추가한다:

```ts
  it('marks a manager as a content manager without owner authority', () => {
    const managerProfileId = '9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d'
    const room = parseRoomManagement(
      {
        created_by: ownerProfileId,
        description: null,
        id: roomId,
        name: '금요일 아침 독서방',
        status: 'active',
      },
      [
        {
          id: '10ff57f4-2f7a-49bb-9c6b-0d724fcb0e55',
          joined_at: '2026-07-17T02:01:30.123+00:00',
          profile_id: ownerProfileId,
          role: 'owner',
          room_avatar_path: null,
          room_display_name: '민규',
          room_id: roomId,
          status: 'active',
        },
        {
          id: '20ff57f4-2f7a-49bb-9c6b-0d724fcb0e55',
          joined_at: '2026-07-18T02:01:30.123+00:00',
          profile_id: managerProfileId,
          role: 'manager',
          room_avatar_path: null,
          room_display_name: '서연',
          room_id: roomId,
          status: 'active',
        },
      ],
      managerProfileId,
    )

    expect(room).toMatchObject({
      canCurrentUserManageContent: true,
      currentUserRole: 'manager',
      isCurrentUserOwner: false,
    })
    expect(room.members.map((member) => member.role)).toEqual(['owner', 'manager'])
  })
```

- [ ] **Step 8: 실패 확인**

Run: `pnpm --filter @talkhugam/web exec vitest run src/entities/room-management/roomManagement.test.ts`
Expected: FAIL — `manager` 행에서 `ZodError`(invalid enum value), 첫 테스트는 `canCurrentUserManageContent` 누락.

- [ ] **Step 9: 웹 방 관리 entity 구현** — `apps/web/src/entities/room-management/roomManagement.ts`

import 추가:

```ts
import { canManageRoomContent, roomRoleSchema, type RoomRole } from '@talkhugam/domain'
```

멤버 행 schema:

```ts
const roomManagementMemberRowSchema = z.object({
  id: z.string().uuid(),
  joined_at: z.string().datetime({ offset: true }),
  profile_id: z.string().uuid().nullable(),
  role: roomRoleSchema,
  room_avatar_path: z.string().nullable(),
  room_display_name: z.string().min(1).max(30),
  room_id: roomIdSchema,
  status: z.literal('active'),
})
```

타입:

```ts
export type RoomManagement = {
  canCurrentUserManageContent: boolean
  createdBy: string | null
  currentUserRole: RoomRole | null
  description: string | null
  id: string
  isCurrentUserOwner: boolean
  members: RoomManagementMember[]
  name: string
  status: 'active' | 'archived' | 'deleted'
}

export type RoomManagementMember = {
  avatarPath: string | null
  displayName: string
  id: string
  isCurrentUser: boolean
  joinedAt: string
  profileId: string | null
  role: RoomRole
}
```

`parseRoomManagement` 본문:

```ts
/** 방 관리 화면에 필요한 방과 활성 멤버 데이터를 현재 사용자 역할이 포함된 도메인 모델로 변환한다. */
export function parseRoomManagement(
  roomValue: unknown,
  memberValue: unknown,
  currentProfileId: string,
): RoomManagement {
  const currentProfile = roomIdSchema.parse(currentProfileId)
  const room = roomManagementRowSchema.parse(roomValue)
  const members = z.array(roomManagementMemberRowSchema).parse(memberValue)
  const currentUserRole = findCurrentUserRole(members, currentProfile)

  return {
    canCurrentUserManageContent: canManageRoomContent(currentUserRole),
    createdBy: room.created_by,
    currentUserRole,
    description: room.description,
    id: room.id,
    isCurrentUserOwner: currentUserRole === 'owner',
    members: members.map((member) => mapRoomManagementMember(member, currentProfile)),
    name: room.name,
    status: room.status,
  }
}
```

파일 아래쪽 private helper 영역(`mapRoomManagementMember` 위)에 추가:

```ts
/** 활성 멤버 목록에서 현재 프로필의 책방 역할을 찾고, 없으면 null을 반환한다. */
function findCurrentUserRole(
  members: readonly z.infer<typeof roomManagementMemberRowSchema>[],
  currentProfileId: string,
): RoomRole | null {
  return members.find((member) => member.profile_id === currentProfileId)?.role ?? null
}
```

- [ ] **Step 10: 웹 오픈 책방 entity 수정과 테스트** — `apps/web/src/entities/community/community.ts`

`@talkhugam/domain` import에 `roomRoleSchema`, `type RoomRole`을 추가하고 schema·타입·mapper를 바꾼다:

```ts
const communityDetailSchema = z
  .array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      description: z.string().nullable(),
      current_member_id: z.string().uuid(),
      current_member_role: roomRoleSchema,
      is_owner: z.boolean(),
    }),
  )
  .length(1)
const communityMessagesSchema = z.array(
  z.object({
    id: z.string().uuid(),
    body: z.string(),
    created_at: z.string().datetime({ offset: true }),
    sender_member_id: z.string().uuid(),
    sender_display_name: z.string(),
    sender_role: roomRoleSchema,
  }),
)
```

```ts
export type CommunityDetail = {
  id: string
  name: string
  description: string | null
  currentMemberId: string
  currentMemberRole: RoomRole
  isOwner: boolean
}
export type CommunityMessage = {
  id: string
  body: string
  createdAt: string
  senderMemberId: string
  senderDisplayName: string
  senderRole: RoomRole
}
```

`getCommunityRoom` 반환 객체에 `currentMemberRole: room.current_member_role,`를, `getCommunityMessages`의 map에 `senderRole: message.sender_role,`를 추가한다. 두 함수의 JSDoc을 「…본인 멤버 역할…」, 「…보낸 사람 역할과 함께…」로 고친다.

`apps/web/src/entities/community/community.test.ts`의 import에 `getCommunityMessages`, `getCommunityRoom`을 추가하고 `describe('community repository')` 안에 추가:

```ts
  it('오픈 책방 상세와 자유 채팅에서 역할을 함께 읽는다', async () => {
    const memberId = '33333333-3333-4333-8333-333333333333'
    const client = createClient()
    client.rpc
      .mockResolvedValueOnce({
        data: [
          {
            current_member_id: memberId,
            current_member_role: 'manager',
            description: null,
            id: roomId,
            is_owner: false,
            name: '밤 독서회',
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            body: '반가워요',
            created_at: '2026-10-27T00:00:00.000Z',
            id: '44444444-4444-4444-8444-444444444444',
            sender_display_name: '참여자',
            sender_member_id: '55555555-5555-4555-8555-555555555555',
            sender_role: 'member',
          },
        ],
        error: null,
      })

    await expect(getCommunityRoom(client as never, roomId)).resolves.toMatchObject({
      currentMemberRole: 'manager',
      isOwner: false,
    })
    await expect(getCommunityMessages(client as never, roomId)).resolves.toEqual([
      expect.objectContaining({ senderRole: 'member' }),
    ])
  })
```

- [ ] **Step 11: 모바일 오픈 책방 entity 수정** — `apps/mobile/src/entities/community/mobileCommunity.ts`

```ts
import {
  createCommunityRoomFormSchema,
  parseCommunityRooms,
  parseJoinCommunityRoomResult,
  roomRoleSchema,
  type CommunityRoom,
  type CreateCommunityRoomForm,
  type JoinCommunityRoomResult,
  type RoomRole,
} from '@talkhugam/domain'
```

```ts
const communityDetailSchema = z
  .array(z.object({ current_member_id: z.string().uuid(), current_member_role: roomRoleSchema, description: z.string().nullable(), id: z.string().uuid(), is_owner: z.boolean(), name: z.string() }))
  .length(1)
const messagesSchema = z.array(z.object({ body: z.string(), created_at: z.string().datetime({ offset: true }), id: z.string().uuid(), sender_display_name: z.string(), sender_member_id: z.string().uuid(), sender_role: roomRoleSchema }))

export type MobileCommunityDetail = { currentMemberId: string; currentMemberRole: RoomRole; description: string | null; id: string; isOwner: boolean; name: string }
export type MobileCommunityMessage = { body: string; createdAt: string; id: string; senderDisplayName: string; senderMemberId: string; senderRole: RoomRole }
```

`getMobileCommunityRoom`의 반환:

```ts
  return { currentMemberId: room.current_member_id, currentMemberRole: room.current_member_role, description: room.description, id: room.id, isOwner: room.is_owner, name: room.name }
```

`getMobileCommunityMessages`의 map:

```ts
  return messagesSchema.parse(response.data).map((message) => ({ body: message.body, createdAt: message.created_at, id: message.id, senderDisplayName: message.sender_display_name, senderMemberId: message.sender_member_id, senderRole: message.sender_role }))
```

JSDoc 두 개를 역할 반환을 설명하도록 고친다(「…현재 회원의 책방 역할을 반환한다.」, 「…보낸 사람 역할과 함께 반환한다.」).

`apps/mobile/src/entities/community/mobileCommunity.test.ts`의 자유 채팅 fixture에 `sender_role: 'member'`를 넣고 기대값을 강화한다:

```ts
      { body: '첫 인사', created_at: '2026-08-18T00:00:00.000Z', id: '44444444-4444-4444-8444-444444444444', sender_display_name: '민규', sender_member_id: '33333333-3333-4333-8333-333333333333', sender_role: 'member' },
```

```ts
    await expect(getMobileCommunityMessages(client as never, roomId)).resolves.toEqual([
      expect.objectContaining({ body: '첫 인사', senderDisplayName: '민규', senderRole: 'member' }),
    ])
```

- [ ] **Step 12: 통과 확인**

Run:
```bash
cd /Users/jmg/Desktop/talkhugam-talk-109
pnpm --filter @talkhugam/domain test
pnpm --filter @talkhugam/web exec vitest run src/entities/room-management src/entities/community
pnpm --filter @talkhugam/mobile exec vitest run src/entities/community
pnpm typecheck:web
pnpm typecheck:mobile
```
Expected: 모두 PASS. `typecheck:web`이 `RoomManagementPage.test.tsx`·`BookDiscussionPage.test.tsx`의 mock 객체에서 새 필드 누락으로 실패하지 않는다(그 mock은 `vi.fn().mockResolvedValue`라 타입 검사 대상이 아니다). 실패하면 T5 Step 1의 mock 수정을 먼저 적용한다.

- [ ] **Step 13: 커밋**

```bash
cd /Users/jmg/Desktop/talkhugam-talk-109
git add packages/domain/src/roomPermission.ts packages/domain/src/roomPermission.test.ts \
  packages/domain/src/index.ts packages/domain/src/video.ts packages/domain/src/video.test.ts \
  apps/web/src/entities/room-management/roomManagement.ts apps/web/src/entities/room-management/roomManagement.test.ts \
  apps/web/src/entities/community/community.ts apps/web/src/entities/community/community.test.ts \
  apps/mobile/src/entities/community/mobileCommunity.ts apps/mobile/src/entities/community/mobileCommunity.test.ts
git commit -m "feat(domain): 책방 운영자 역할 helper와 schema 확장"
```

---

### Task 5: 웹·모바일 화면이 운영자 역할을 따르도록 연결

**Files:**
- Modify: `apps/web/src/pages/rooms/RoomManagementPage.tsx`, `RoomManagementPage.test.tsx`
- Modify: `apps/web/src/pages/rooms/BookDiscussionPage.tsx`, `BookDiscussionPage.test.tsx`
- Modify: `apps/web/src/pages/community/CommunityRoomDetailPage.tsx`; Create: `apps/web/src/pages/community/CommunityRoomDetailPage.test.tsx`
- Modify: `apps/mobile/src/features/community/MobileCommunityEntryScreens.tsx`; Create: `apps/mobile/tests/MobileCommunityRoomDetailScreen.test.tsx`

**Interfaces:**
- Consumes: T4의 `RoomManagement.canCurrentUserManageContent`, `RoomManagement.isCurrentUserOwner`, `RoomManagementMember.role`, `formatRoomRoleLabel`, `canBanCommunityMember`, `CommunityDetail.currentMemberRole`, `CommunityMessage.senderRole`, `MobileCommunityDetail.currentMemberRole`, `MobileCommunityMessage.senderRole`
- Produces: `ChatComposer` prop 이름 `canCreateRoomInvite: boolean` (기존 `isCurrentUserOwner` 대체, `BookDiscussionPage.tsx` 내부 전용)

화면 규칙:
- 방 관리(`/rooms/:roomId/manage`): 「방 관리」 섹션과 「초대 코드 만들기」는 방장·운영자, 「방 설정」 버튼·「방장만 관리할 수 있어요」 안내·멤버 `⋯` 메뉴(이양·내보내기)·「방 보관하고 나가기」는 방장만. 멤버 역할 표기는 `formatRoomRoleLabel`.
- 책 대화 `+` 메뉴: 방장·운영자는 「책방 초대하기」, 참여자는 「초대 요청」.
- 오픈 책방 자유 채팅: `canBanCommunityMember(현재 역할, 보낸 사람 역할)`이고 자기 메시지가 아닐 때만 「퇴장·차단」.

- [ ] **Step 1: 기존 화면 테스트 mock에 새 필드 추가**

`apps/web/src/pages/rooms/RoomManagementPage.test.tsx`의 `getRoomManagement` mock 두 곳(hoisted 기본값, `beforeEach`)을 다음으로 바꾼다:

```ts
  getRoomManagement: vi.fn().mockResolvedValue({
    canCurrentUserManageContent: true,
    createdBy: '00000000-0000-0000-0000-000000000001',
    currentUserRole: 'owner',
    description: null,
    id: '00000000-0000-0000-0000-000000000101',
    isCurrentUserOwner: true,
    members: [],
    name: '금요일 아침 책방',
    status: 'active',
  }),
```

```ts
    getRoomManagement.mockResolvedValue({
      canCurrentUserManageContent: true,
      createdBy: '00000000-0000-0000-0000-000000000001',
      currentUserRole: 'owner',
      description: null,
      id: '00000000-0000-0000-0000-000000000101',
      isCurrentUserOwner: true,
      members: [],
      name: '금요일 아침 책방',
      status: 'active',
    })
```

`apps/web/src/pages/rooms/BookDiscussionPage.test.tsx`의 hoisted `getRoomManagement` mock에 `canCurrentUserManageContent: true, currentUserRole: 'owner',`를, `lets a non-owner request an invite…` 테스트의 `mockResolvedValueOnce` 객체에 `canCurrentUserManageContent: false, currentUserRole: 'member',`를 추가한다.

- [ ] **Step 2: 운영자 화면 실패 테스트 작성**

`RoomManagementPage.test.tsx`의 `describe('RoomManagementPage')`에 추가:

```ts
  it('lets a manager create invites without owner-only settings and member menus', async () => {
    getRoomManagement.mockResolvedValueOnce({
      canCurrentUserManageContent: true,
      createdBy: '00000000-0000-0000-0000-000000000001',
      currentUserRole: 'manager',
      description: null,
      id: '00000000-0000-0000-0000-000000000101',
      isCurrentUserOwner: false,
      members: [
        {
          avatarPath: null,
          displayName: '민규',
          id: '00000000-0000-0000-0000-000000000201',
          isCurrentUser: false,
          joinedAt: '2026-07-17T02:01:30.123+00:00',
          profileId: null,
          role: 'owner',
        },
        {
          avatarPath: null,
          displayName: '서연',
          id: '00000000-0000-0000-0000-000000000202',
          isCurrentUser: true,
          joinedAt: '2026-07-18T02:01:30.123+00:00',
          profileId: null,
          role: 'manager',
        },
        {
          avatarPath: null,
          displayName: '지우',
          id: '00000000-0000-0000-0000-000000000203',
          isCurrentUser: false,
          joinedAt: '2026-07-19T02:01:30.123+00:00',
          profileId: null,
          role: 'member',
        },
      ],
      name: '금요일 아침 책방',
      status: 'active',
    })

    renderRoomManagementPage()

    expect(await screen.findByRole('button', { name: '초대 코드 만들기' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '방 설정' })).not.toBeInTheDocument()
    expect(screen.getByText('방장')).toBeInTheDocument()
    expect(screen.getByText('운영자')).toBeInTheDocument()
    expect(screen.getByText('멤버')).toBeInTheDocument()
    expect(screen.queryByLabelText('지우 관리')).not.toBeInTheDocument()
    expect(screen.queryByText('방장만 관리할 수 있어요')).not.toBeInTheDocument()
  })
```

`BookDiscussionPage.test.tsx`에 추가:

```ts
  it('lets a manager create an invite instead of requesting one', async () => {
    getRoomManagement.mockResolvedValueOnce({
      canCurrentUserManageContent: true,
      createdBy: '00000000-0000-0000-0000-000000000001',
      currentUserRole: 'manager',
      description: null,
      id: 'room-1',
      isCurrentUserOwner: false,
      members: [],
      name: '금요일 아침 책방',
      status: 'active',
    })
    renderBookDiscussionPage()

    fireEvent.click(screen.getByRole('button', { name: '메시지 추가 메뉴 열기' }))

    expect(await screen.findByRole('button', { name: '책방 초대하기' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '초대 요청' })).not.toBeInTheDocument()
  })
```

Create `apps/web/src/pages/community/CommunityRoomDetailPage.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CommunityRoomDetailPage } from './CommunityRoomDetailPage'

const { getCommunityMessages, getCommunityRoom } = vi.hoisted(() => ({
  getCommunityMessages: vi.fn(),
  getCommunityRoom: vi.fn(),
}))

vi.mock('../../entities/community', () => ({
  banCommunityMember: vi.fn(),
  communityKeys: {
    detail: (roomId: string) => ['community-rooms', 'detail', roomId],
    messages: (roomId: string) => ['community-rooms', 'messages', roomId],
  },
  getCommunityMessages,
  getCommunityRoom,
  reportCommunityTarget: vi.fn(),
  sendCommunityMessage: vi.fn(),
}))

vi.mock('../../shared/api/supabaseClient', () => ({ createSupabaseClient: vi.fn() }))

const roomId = '22222222-2222-4222-8222-222222222222'
const currentMemberId = '33333333-3333-4333-8333-333333333333'
const messages = [
  {
    body: '방장 공지',
    createdAt: '2026-10-27T00:00:00.000Z',
    id: '44444444-4444-4444-8444-444444444441',
    senderDisplayName: '방장',
    senderMemberId: '55555555-5555-4555-8555-555555555551',
    senderRole: 'owner',
  },
  {
    body: '운영 안내',
    createdAt: '2026-10-27T00:01:00.000Z',
    id: '44444444-4444-4444-8444-444444444442',
    senderDisplayName: '다른 운영자',
    senderMemberId: '55555555-5555-4555-8555-555555555552',
    senderRole: 'manager',
  },
  {
    body: '반가워요',
    createdAt: '2026-10-27T00:02:00.000Z',
    id: '44444444-4444-4444-8444-444444444443',
    senderDisplayName: '참여자',
    senderMemberId: '55555555-5555-4555-8555-555555555553',
    senderRole: 'member',
  },
]

describe('CommunityRoomDetailPage', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('shows ban only on regular member messages for a manager', async () => {
    getCommunityRoom.mockResolvedValue({
      currentMemberId,
      currentMemberRole: 'manager',
      description: null,
      id: roomId,
      isOwner: false,
      name: '주말 독서회',
    })
    getCommunityMessages.mockResolvedValue(messages)

    renderCommunityRoomDetailPage()

    expect(await screen.findByText('반가워요')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '퇴장·차단' })).toHaveLength(1)
  })

  it('hides ban for a regular member', async () => {
    getCommunityRoom.mockResolvedValue({
      currentMemberId,
      currentMemberRole: 'member',
      description: null,
      id: roomId,
      isOwner: false,
      name: '주말 독서회',
    })
    getCommunityMessages.mockResolvedValue(messages)

    renderCommunityRoomDetailPage()

    expect(await screen.findByText('반가워요')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '퇴장·차단' })).not.toBeInTheDocument()
  })
})

/** 오픈 책방 상세 화면을 라우터와 서버 상태 Provider 안에서 렌더링한다. */
function renderCommunityRoomDetailPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/community/${roomId}`]}>
        <Routes>
          <Route path="/community/:roomId" element={<CommunityRoomDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
```

Create `apps/mobile/tests/MobileCommunityRoomDetailScreen.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react-native'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import type { PropsWithChildren } from 'react'

jest.mock('../src/entities/community')
jest.mock('../src/entities/profile')
jest.mock('../src/shared/api/mobileSupabaseClient')

import { getMobileCommunityMessages, getMobileCommunityRoom } from '../src/entities/community'
import { MobileCommunityRoomDetailScreen } from '../src/features/community/MobileCommunityEntryScreens'
import { createMobileSupabaseClient } from '../src/shared/api/mobileSupabaseClient'

const mockGetRoom = jest.mocked(getMobileCommunityRoom)
const mockGetMessages = jest.mocked(getMobileCommunityMessages)
const mockCreateClient = jest.mocked(createMobileSupabaseClient)
const roomId = '11111111-1111-4111-8111-111111111111'

/** 테스트마다 독립된 query cache로 화면을 감싸는 래퍼를 만든다. */
function createQueryWrapper(): ({ children }: PropsWithChildren) => React.JSX.Element {
  const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } })
  /** 화면에 서버 상태 Provider를 제공한다. */
  return function QueryWrapper({ children }: PropsWithChildren): React.JSX.Element {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('MobileCommunityRoomDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCreateClient.mockReturnValue({} as never)
    mockGetMessages.mockResolvedValue([
      { body: '방장 공지', createdAt: '2026-10-27T00:00:00.000Z', id: '44444444-4444-4444-8444-444444444441', senderDisplayName: '방장', senderMemberId: '55555555-5555-4555-8555-555555555551', senderRole: 'owner' },
      { body: '운영 안내', createdAt: '2026-10-27T00:01:00.000Z', id: '44444444-4444-4444-8444-444444444442', senderDisplayName: '다른 운영자', senderMemberId: '55555555-5555-4555-8555-555555555552', senderRole: 'manager' },
      { body: '반가워요', createdAt: '2026-10-27T00:02:00.000Z', id: '44444444-4444-4444-8444-444444444443', senderDisplayName: '참여자', senderMemberId: '55555555-5555-4555-8555-555555555553', senderRole: 'member' },
    ])
  })

  it('운영자에게는 참여자 메시지에만 퇴장·차단을 보여 준다', async () => {
    mockGetRoom.mockResolvedValue({ currentMemberId: '33333333-3333-4333-8333-333333333333', currentMemberRole: 'manager', description: null, id: roomId, isOwner: false, name: '주말 독서회' })

    render(<MobileCommunityRoomDetailScreen onBack={jest.fn()} roomId={roomId} />, { wrapper: createQueryWrapper() })

    expect(await screen.findByRole('button', { name: '참여자 퇴장·차단' })).toBeVisible()
    expect(screen.queryByRole('button', { name: '방장 퇴장·차단' })).toBeNull()
    expect(screen.queryByRole('button', { name: '다른 운영자 퇴장·차단' })).toBeNull()
  })

  it('참여자에게는 퇴장·차단을 보여 주지 않는다', async () => {
    mockGetRoom.mockResolvedValue({ currentMemberId: '33333333-3333-4333-8333-333333333333', currentMemberRole: 'member', description: null, id: roomId, isOwner: false, name: '주말 독서회' })

    render(<MobileCommunityRoomDetailScreen onBack={jest.fn()} roomId={roomId} />, { wrapper: createQueryWrapper() })

    expect(await screen.findByText('반가워요')).toBeVisible()
    expect(screen.queryByRole('button', { name: '참여자 퇴장·차단' })).toBeNull()
  })
})
```

- [ ] **Step 3: 실패 확인**

Run:
```bash
cd /Users/jmg/Desktop/talkhugam-talk-109
pnpm --filter @talkhugam/web exec vitest run src/pages/rooms/RoomManagementPage.test.tsx src/pages/rooms/BookDiscussionPage.test.tsx src/pages/community/CommunityRoomDetailPage.test.tsx
pnpm --filter @talkhugam/mobile exec jest --runInBand tests/MobileCommunityRoomDetailScreen.test.tsx
```
Expected: 새 운영자 테스트 4개(웹 3, 모바일 1)가 FAIL(초대 섹션 미표시, 「멤버」로 표기, 제재 버튼 없음). 기존 테스트는 PASS.

- [ ] **Step 4: 방 관리 화면 구현** — `apps/web/src/pages/rooms/RoomManagementPage.tsx`

import 추가:

```ts
import { formatRoomRoleLabel } from '@talkhugam/domain'
```

컴포넌트 JSDoc을 `/** 방장·운영자·멤버가 역할에 맞춰 방 정보, 초대, 멤버 구성을 관리하는 화면을 렌더링한다. */`로 바꾼다.

「방 관리」 섹션 시작과 버튼 grid를 다음으로 바꾼다(기존 `{room.isCurrentUserOwner ? (` → `room.canCurrentUserManageContent`, 「방 설정」은 방장만):

```tsx
      {room.canCurrentUserManageContent ? (
        <section className="mt-8" aria-labelledby="room-management-actions">
          <h2 className="text-ink text-base font-semibold" id="room-management-actions">
            방 관리
          </h2>
          <div className={room.isCurrentUserOwner ? 'mt-4 grid grid-cols-2 gap-3' : 'mt-4 grid gap-3'}>
            <ActionButton
              className="talkhugam-foundation-action--outline w-full"
              onClick={() => inviteMutation.mutate()}
              size="large"
              type="button"
              variant="neutralOutline"
            >
              초대 코드 만들기
            </ActionButton>
            {room.isCurrentUserOwner ? (
              <ActionButton
                className="w-full"
                onClick={() => void navigate(`/rooms/${roomId}/manage/settings`)}
                size="large"
                type="button"
                variant="neutralOutline"
              >
                방 설정
              </ActionButton>
            ) : null}
          </div>
```

섹션의 나머지(초대 진행·오류·공유 영역)와 닫는 `</section>) : null}`은 그대로 둔다. 멤버 목록 안내 문구(`방장만 관리할 수 있어요`), `MemberMenu` 조건, 나가기 버튼 조건의 `room.isCurrentUserOwner`는 바꾸지 않는다.

`MemberProfileLink`의 역할 표기:

```tsx
      <span className="text-ink-subtle mt-1 block text-xs">{formatRoomRoleLabel(member.role)}</span>
```

- [ ] **Step 5: 책 대화 `+` 메뉴 구현** — `apps/web/src/pages/rooms/BookDiscussionPage.tsx`

`ChatComposer` 호출부:

```tsx
        canCreateRoomInvite={roomManagementQuery.data?.canCurrentUserManageContent ?? false}
```

`ChatComposer`의 구조 분해 인자 `isCurrentUserOwner,` → `canCreateRoomInvite,`, props 타입 `isCurrentUserOwner: boolean` → `canCreateRoomInvite: boolean`, 메뉴 분기 `{isCurrentUserOwner ? (` → `{canCreateRoomInvite ? (`로 바꾼다(prop 정렬 규칙상 `canCreateRoomInvite`를 목록 맨 앞에 둔다). `handleOpenRoomInvite`의 JSDoc을 `/** 방장 또는 운영자가 새 초대 코드를 만들거나 이미 만든 초대를 공유 시트로 연다. */`로, `handleRequestRoomInvite`의 JSDoc을 `/** 현재 책방의 방장과 운영자에게 친구 초대를 요청한다. */`로 고친다.

초대 요청 성공 문구 `방장에게 책방 초대를 요청했어요.`는 테스트가 고정한 문구이므로 이번 PR에서는 그대로 둔다(3단계 「방 정보」 허브에서 문안 검사와 함께 정리).

- [ ] **Step 6: 오픈 책방 제재 버튼 구현**

`apps/web/src/pages/community/CommunityRoomDetailPage.tsx`:

```ts
import { canBanCommunityMember } from '@talkhugam/domain'
```

메시지 목록의 조건:

```tsx
                {canBanCommunityMember(roomQuery.data.currentMemberRole, message.senderRole) &&
                message.senderMemberId !== roomQuery.data.currentMemberId ? (
```

JSDoc 두 곳을 고친다: 컴포넌트 `/** 활성 오픈 책방 멤버의 자유 채팅, 방장·운영자 제재, 신고 동작을 렌더링한다. */`, `handleBan` `/** 방장·운영자 권한으로 메시지를 남긴 멤버를 제재하고 방 데이터를 새로고침한다. */`.

`apps/mobile/src/features/community/MobileCommunityEntryScreens.tsx`:

첫 줄 import를 다음으로 바꾼다:

```ts
import { canBanCommunityMember, createCommunityRoomFormSchema, communityKeys, type CreateCommunityRoomForm } from '@talkhugam/domain'
```

상세 화면 return 문 안의 조건 문자열을 정확히 치환한다:

- 찾을 문자열: `{roomQuery.data.isOwner && message.senderMemberId !== roomQuery.data.currentMemberId ? (`
- 바꿀 문자열: `{canBanCommunityMember(roomQuery.data.currentMemberRole, message.senderRole) && message.senderMemberId !== roomQuery.data.currentMemberId ? (`

JSDoc 두 곳: `/** 활성 멤버 전용 자유 채팅과 방장·운영자 제재·방 신고 제어를 표시한다. */`, `/** 방장과 운영자가 역할 규칙에 맞는 멤버를 퇴장·차단하며 메시지 목록을 갱신한다. */`.

- [ ] **Step 7: 통과 확인**

Run:
```bash
cd /Users/jmg/Desktop/talkhugam-talk-109
pnpm --filter @talkhugam/web exec vitest run src/pages/rooms src/pages/community
pnpm --filter @talkhugam/mobile exec jest --runInBand tests/MobileCommunityRoomDetailScreen.test.tsx tests/MobileCommunityRoomsScreen.test.tsx
pnpm typecheck:web && pnpm typecheck:mobile && pnpm docs:functions:web
```
Expected: 모두 PASS.

- [ ] **Step 8: 320px·640px 화면 확인** — `pnpm dev:web`로 띄우고 브라우저(또는 `run` skill)에서 운영자 계정 mock 없이 확인이 어렵다면, Playwright `ui-health.spec.ts`의 방 관리 테스트가 그대로 통과하는지 Task 7의 CI에서 확인한다. 「방 설정」이 빠진 단일 열 버튼이 320px에서 줄바꿈 없이 보이는지는 PR 본문의 「자동화하지 못한 범위」에 적는다.

- [ ] **Step 9: 커밋**

```bash
cd /Users/jmg/Desktop/talkhugam-talk-109
git add apps/web/src/pages/rooms/RoomManagementPage.tsx apps/web/src/pages/rooms/RoomManagementPage.test.tsx \
  apps/web/src/pages/rooms/BookDiscussionPage.tsx apps/web/src/pages/rooms/BookDiscussionPage.test.tsx \
  apps/web/src/pages/community/CommunityRoomDetailPage.tsx apps/web/src/pages/community/CommunityRoomDetailPage.test.tsx \
  apps/mobile/src/features/community/MobileCommunityEntryScreens.tsx apps/mobile/tests/MobileCommunityRoomDetailScreen.test.tsx
git commit -m "feat(rooms): 운영자에게 초대와 오픈 책방 제재 버튼 표시"
```

---

### Task 6: 책 대화 추가를 방장·운영자로 제한 (독립 태스크)

> 열린 질문 1에서 「4단계로 미룬다」로 결정되면 이 태스크 전체를 건너뛴다. 다른 태스크는 이 태스크에 의존하지 않는다.

**Files:**
- Create: `supabase/migrations/20261027000500_restrict_book_chat_creation_to_managers.sql`
- Create: `supabase/tests/database/245_room_manager_book_chat_creation.test.sql`
- Modify: `apps/web/src/entities/room-management/roomManagement.ts`, `roomManagement.test.ts`, `index.ts`
- Modify: `apps/web/src/pages/rooms/RoomDetailPage.tsx`, `RoomDetailPage.test.tsx`
- Modify: `apps/web/e2e/ui-health.spec.ts` (책방 상세 테스트에 역할 RPC mock)
- Modify: `apps/mobile/src/entities/reading-room/mobileRoomDetail.ts`, `mobileRoomDetail.test.ts`, `index.ts`
- Modify: `apps/mobile/src/features/reading-room/MobileRoomDetailScreen.tsx`, `apps/mobile/tests/RoomDetailScreen.test.tsx`

**Interfaces:**
- Consumes: T1 `public.get_my_room_role(p_room_id uuid) returns public.member_role`, T4 `parseRoomRole`, `canManageRoomContent`, `roomRoleKeys.mine`, `type RoomRole`
- Produces:
  - `public.create_book_chat(...)` — 시그니처 동일, 활성 방장·운영자만
  - 웹 `getMyRoomRole(client: SupabaseClient, roomId: string): Promise<RoomRole | null>` (`entities/room-management` 공개)
  - 모바일 `getMobileMyRoomRole(client: SupabaseClient, roomId: string): Promise<RoomRole | null>` (`entities/reading-room` 공개)

- [ ] **Step 1: 실패하는 pgTAP 작성** — `supabase/tests/database/245_room_manager_book_chat_creation.test.sql`

```sql
begin;

\ir ../helpers/auth.inc

select plan(8);

select tests.create_supabase_user('00000000-0000-0000-0000-000000000391', 'book-owner@test.local', '책 방장');
select tests.create_supabase_user('00000000-0000-0000-0000-000000000392', 'book-manager@test.local', '책 운영자');
select tests.create_supabase_user('00000000-0000-0000-0000-000000000393', 'book-member@test.local', '책 참여자');
select tests.create_supabase_user('00000000-0000-0000-0000-000000000394', 'book-outsider@test.local', '책 외부');

insert into public.reading_rooms (id, name, created_by)
values ('10000000-0000-0000-0000-000000000391', '책 추가 권한 책방', '00000000-0000-0000-0000-000000000391');

insert into public.reading_rooms (id, name, created_by, room_kind, access, capacity)
values ('10000000-0000-0000-0000-000000000392', '책 추가 권한 오픈 책방', '00000000-0000-0000-0000-000000000391', 'community', 'public', 10::smallint);

insert into public.room_members (id, room_id, profile_id, role, room_display_name)
values
  ('20000000-0000-0000-0000-000000000391', '10000000-0000-0000-0000-000000000391', '00000000-0000-0000-0000-000000000391', 'owner', '책 방장'),
  ('20000000-0000-0000-0000-000000000392', '10000000-0000-0000-0000-000000000391', '00000000-0000-0000-0000-000000000392', 'manager', '책 운영자'),
  ('20000000-0000-0000-0000-000000000393', '10000000-0000-0000-0000-000000000391', '00000000-0000-0000-0000-000000000393', 'member', '책 참여자'),
  ('20000000-0000-0000-0000-000000000394', '10000000-0000-0000-0000-000000000392', '00000000-0000-0000-0000-000000000391', 'owner', '오픈 책 방장'),
  ('20000000-0000-0000-0000-000000000395', '10000000-0000-0000-0000-000000000392', '00000000-0000-0000-0000-000000000392', 'manager', '오픈 책 운영자'),
  ('20000000-0000-0000-0000-000000000396', '10000000-0000-0000-0000-000000000392', '00000000-0000-0000-0000-000000000393', 'member', '오픈 책 참여자');

select tests.authenticate_as('00000000-0000-0000-0000-000000000391');
set local role authenticated;

select lives_ok(
  $$select * from public.create_book_chat('10000000-0000-0000-0000-000000000391', 'manual', '방장이 고른 책', '방장 책 대화')$$,
  '방장은 책 대화를 추가할 수 있어야 한다'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000392');
set local role authenticated;

select lives_ok(
  $$select * from public.create_book_chat('10000000-0000-0000-0000-000000000391', 'manual', '운영자가 고른 책', '운영자 책 대화')$$,
  '운영자는 비공개 책방에 책 대화를 추가할 수 있어야 한다'
);
select lives_ok(
  $$select * from public.create_book_chat('10000000-0000-0000-0000-000000000392', 'manual', '오픈 운영자가 고른 책', '오픈 운영자 책 대화')$$,
  '운영자는 오픈 책방에도 책 대화를 추가할 수 있어야 한다'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000393');
set local role authenticated;

select throws_ok(
  $$select * from public.create_book_chat('10000000-0000-0000-0000-000000000391', 'manual', '참여자가 고른 책', '참여자 책 대화')$$,
  'P0001', 'ROOM_FORBIDDEN',
  '참여자는 비공개 책방에 책 대화를 바로 추가할 수 없어야 한다'
);
select throws_ok(
  $$select * from public.create_book_chat('10000000-0000-0000-0000-000000000392', 'manual', '오픈 참여자가 고른 책', '오픈 참여자 책 대화')$$,
  'P0001', 'ROOM_FORBIDDEN',
  '참여자는 오픈 책방에 책 대화를 바로 추가할 수 없어야 한다'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000394');
set local role authenticated;

select throws_ok(
  $$select * from public.create_book_chat('10000000-0000-0000-0000-000000000391', 'manual', '외부 책', '외부 책 대화')$$,
  'P0001', 'ROOM_FORBIDDEN',
  '외부 사용자는 책 대화를 추가할 수 없어야 한다'
);

reset role;

select is(
  (select count(*) from public.book_chats where created_by_member_id in ('20000000-0000-0000-0000-000000000392', '20000000-0000-0000-0000-000000000395')),
  2::bigint,
  '운영자가 만든 책 대화는 운영자 멤버로 기록되어야 한다'
);
select is(
  (select count(*) from public.book_chats where room_id in ('10000000-0000-0000-0000-000000000391', '10000000-0000-0000-0000-000000000392')),
  3::bigint,
  '허용된 역할의 책 대화만 만들어져야 한다'
);

select * from finish();

rollback;
```

- [ ] **Step 2: 마이그레이션 작성** — `supabase/migrations/20261027000500_restrict_book_chat_creation_to_managers.sql`

`20260716001100_secure_books_and_chats.sql`의 `create_book_chat` 본문을 그대로 옮기고, 멤버 조회에 역할 조건 한 줄만 추가한다.

```sql
create or replace function public.create_book_chat(
  p_room_id uuid,
  p_source public.book_source,
  p_title text,
  p_name text,
  p_authors text[] default '{}',
  p_isbn10 text default null,
  p_isbn13 text default null,
  p_publisher text default null,
  p_published_at date default null,
  p_thumbnail_url text default null,
  p_external_url text default null
)
returns table (book_id uuid, book_chat_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_member_id uuid;
  v_book_id uuid;
  v_book_chat_id uuid;
  v_isbn10 text := upper(regexp_replace(coalesce(p_isbn10, ''), '[^0-9X]', '', 'g'));
  v_isbn13 text := regexp_replace(coalesce(p_isbn13, ''), '[^0-9]', '', 'g');
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  select member.id
  into v_member_id
  from public.room_members as member
  join public.reading_rooms as room on room.id = member.room_id
  where member.room_id = p_room_id
    and member.profile_id = auth.uid()
    and member.status = 'active'
    and member.role in ('owner', 'manager')
    and room.status = 'active'
    and room.deleted_at is null;

  if v_member_id is null then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  if char_length(btrim(p_title)) not between 1 and 200
    or char_length(btrim(p_name)) not between 1 and 60
  then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  v_isbn10 := nullif(v_isbn10, '');
  v_isbn13 := nullif(v_isbn13, '');

  if p_source = 'kakao' and v_isbn10 is null and v_isbn13 is null then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  if v_isbn13 is not null then
    insert into public.books (
      source, isbn13, isbn10, title, authors, publisher,
      published_at, thumbnail_url, external_url
    )
    values (
      p_source, v_isbn13, v_isbn10, btrim(p_title), coalesce(p_authors, '{}'),
      nullif(btrim(p_publisher), ''), p_published_at,
      nullif(btrim(p_thumbnail_url), ''), nullif(btrim(p_external_url), '')
    )
    on conflict (isbn13) where isbn13 is not null do update
    set
      source = case when books.source = 'kakao' then books.source else excluded.source end,
      isbn10 = coalesce(books.isbn10, excluded.isbn10),
      title = excluded.title,
      authors = excluded.authors,
      publisher = excluded.publisher,
      published_at = excluded.published_at,
      thumbnail_url = excluded.thumbnail_url,
      external_url = excluded.external_url
    returning id into v_book_id;
  elsif v_isbn10 is not null then
    insert into public.books (
      source, isbn10, title, authors, publisher,
      published_at, thumbnail_url, external_url
    )
    values (
      p_source, v_isbn10, btrim(p_title), coalesce(p_authors, '{}'),
      nullif(btrim(p_publisher), ''), p_published_at,
      nullif(btrim(p_thumbnail_url), ''), nullif(btrim(p_external_url), '')
    )
    on conflict (isbn10) where isbn10 is not null do update
    set
      source = case when books.source = 'kakao' then books.source else excluded.source end,
      title = excluded.title,
      authors = excluded.authors,
      publisher = excluded.publisher,
      published_at = excluded.published_at,
      thumbnail_url = excluded.thumbnail_url,
      external_url = excluded.external_url
    returning id into v_book_id;
  else
    insert into public.books (source, title, authors, publisher, published_at)
    values (
      p_source,
      btrim(p_title),
      coalesce(p_authors, '{}'),
      nullif(btrim(p_publisher), ''),
      p_published_at
    )
    returning id into v_book_id;
  end if;

  insert into public.book_chats (
    room_id,
    book_id,
    created_by_member_id,
    name
  )
  values (p_room_id, v_book_id, v_member_id, btrim(p_name))
  returning id into v_book_chat_id;

  return query select v_book_id, v_book_chat_id;
end;
$$;

comment on function public.create_book_chat(
  uuid, public.book_source, text, text, text[], text, text, text, date, text, text
) is '활성 책방의 방장 또는 운영자만 책 정보를 정규화해 저장하고 새 책 대화를 만든다.';
```

- [ ] **Step 3: 웹 역할 조회 entity 실패 테스트** — `apps/web/src/entities/room-management/roomManagement.test.ts`

import 목록에 `getMyRoomRole`을 추가하고 파일 끝에 추가:

```ts
describe('getMyRoomRole', () => {
  it('reads the current room role through the narrow RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 'manager', error: null })

    await expect(getMyRoomRole({ rpc } as unknown as SupabaseClient, roomId)).resolves.toBe('manager')
    expect(rpc).toHaveBeenCalledWith('get_my_room_role', { p_room_id: roomId })
  })

  it('returns null when the user is not an active member', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null })

    await expect(getMyRoomRole({ rpc } as unknown as SupabaseClient, roomId)).resolves.toBeNull()
  })
})
```

Run: `pnpm --filter @talkhugam/web exec vitest run src/entities/room-management/roomManagement.test.ts`
Expected: FAIL — `getMyRoomRole is not a function`(또는 export 없음 타입 오류).

- [ ] **Step 4: 웹 역할 조회 구현** — `apps/web/src/entities/room-management/roomManagement.ts`

domain import에 `parseRoomRole`을 추가하고 `getArchivedRooms` 아래에 추가:

```ts
/** 현재 사용자의 활성 책방 역할을 서버 RPC로 조회하고, 활성 멤버가 아니면 null을 반환한다. */
export async function getMyRoomRole(
  client: SupabaseClient,
  roomId: string,
): Promise<RoomRole | null> {
  const response = await client.rpc('get_my_room_role', { p_room_id: roomIdSchema.parse(roomId) })

  if (response.error) throw response.error
  return parseRoomRole(response.data)
}
```

`apps/web/src/entities/room-management/index.ts`의 export 목록에 `getMyRoomRole,`을 추가한다(알파벳 순서: `getArchivedRooms,` 다음).

- [ ] **Step 5: 웹 책방 상세 실패 테스트** — `apps/web/src/pages/rooms/RoomDetailPage.test.tsx`

hoisted mock과 모듈 mock을 추가한다:

```ts
const { getBookChats, getMyRoomRole, getReadingRoom } = vi.hoisted(() => ({
  getBookChats: vi.fn(),
  getMyRoomRole: vi.fn().mockResolvedValue('owner'),
  getReadingRoom: vi.fn(),
}))

vi.mock('../../entities/room-management', () => ({ getMyRoomRole }))
```

`describe('RoomDetailPage')`에 추가:

```ts
  it('offers a new book action to owners and managers', async () => {
    getReadingRoom.mockResolvedValue({ description: null, id: 'room-1', name: '금요일 아침 모임' })
    getBookChats.mockResolvedValue([])
    getMyRoomRole.mockResolvedValue('manager')

    renderRoomDetailPage('/rooms/room-1')

    expect(await screen.findByRole('button', { name: '새 책' })).toBeInTheDocument()
    expect(screen.getByText('첫 책을 골라 이야기를 시작해 보세요.')).toBeInTheDocument()
  })

  it('hides the new book action from regular members', async () => {
    getReadingRoom.mockResolvedValue({ description: null, id: 'room-1', name: '금요일 아침 모임' })
    getBookChats.mockResolvedValue([])
    getMyRoomRole.mockResolvedValue('member')

    renderRoomDetailPage('/rooms/room-1')

    expect(
      await screen.findByText('방장이나 운영자가 첫 책을 고르면 이야기를 시작할 수 있어요.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '새 책' })).not.toBeInTheDocument()
  })
```

Run: `pnpm --filter @talkhugam/web exec vitest run src/pages/rooms/RoomDetailPage.test.tsx`
Expected: 두 번째 새 테스트 FAIL(버튼이 항상 보이고 안내 문구 없음).

- [ ] **Step 6: 웹 책방 상세 구현** — `apps/web/src/pages/rooms/RoomDetailPage.tsx`

import 추가:

```ts
import { canManageRoomContent, roomRoleKeys } from '@talkhugam/domain'

import { getMyRoomRole } from '../../entities/room-management'
```

`chatsQuery` 선언 바로 아래에 추가:

```ts
  const roleQuery = useQuery({
    enabled: Boolean(roomId) && Boolean(roomQuery.data),
    queryFn: () => getMyRoomRole(createSupabaseClient(), roomId ?? ''),
    queryKey: roomRoleKeys.mine(roomId ?? ''),
  })
```

early return들 아래, `handleRetryBookChats` 위에 추가:

```ts
  const canAddBook = canManageRoomContent(roleQuery.data ?? null)
```

헤더 「새 책」 버튼을 조건부로 감싼다:

```tsx
            {canAddBook ? (
              <ActionButton
                className="text-primary min-h-11 px-3"
                onClick={() => void navigate(`/rooms/${roomId}/books/new`)}
                size="small"
                type="button"
                variant="ghost"
              >
                새 책
              </ActionButton>
            ) : null}
```

`BookChatsContent` 호출에 `canAddBook={canAddBook}`을 넘기고, `BookChatsContent`의 구조 분해 인자·props 타입에 `canAddBook: boolean`을 추가한 뒤 빈 상태 분기를 `if (!chats || chats.length === 0) return <EmptyBookChats canAddBook={canAddBook} />`로 바꾼다. `EmptyBookChats`를 다음으로 교체한다:

```tsx
/** 책 추가 권한에 맞춰 빈 책방 안내 문구를 렌더링한다. */
function EmptyBookChats({ canAddBook }: { canAddBook: boolean }) {
  return (
    <div className="talkhugam-information-surface border-ink/10 mt-6 rounded-lg border p-6 text-center">
      <p className="text-ink text-base font-medium">아직 함께 읽는 책이 없어요</p>
      <p className="text-ink-subtle mt-2 text-sm">
        {canAddBook
          ? '첫 책을 골라 이야기를 시작해 보세요.'
          : '방장이나 운영자가 첫 책을 고르면 이야기를 시작할 수 있어요.'}
      </p>
    </div>
  )
}
```

새 문구는 `talkhugam-copy-review` skill로 톤을 확인하고 320px에서 한 단어만 넘어가지 않는지 본다. 넘어가면 `talkhugam-balanced-copy` 클래스를 붙인다.

- [ ] **Step 7: Playwright mock 추가** — `apps/web/e2e/ui-health.spec.ts`의 `renders room detail command controls with SEED components` 테스트에서 `page.goto` 앞에 추가:

```ts
  await page.route('**/rest/v1/rpc/get_my_room_role', async (route) => {
    await route.fulfill({
      body: JSON.stringify('owner'),
      contentType: 'application/json',
      status: 200,
    })
  })
```

- [ ] **Step 8: 모바일 역할 조회 entity 실패 테스트** — `apps/mobile/src/entities/reading-room/mobileRoomDetail.test.ts`

import에 `getMobileMyRoomRole`을 추가하고 파일 끝에 추가:

```ts
describe('getMobileMyRoomRole', () => {
  it('reads the current room role through the narrow RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 'owner', error: null })

    await expect(getMobileMyRoomRole({ rpc } as never, roomId)).resolves.toBe('owner')
    expect(rpc).toHaveBeenCalledWith('get_my_room_role', { p_room_id: roomId })
  })

  it('returns null when the member is no longer active', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null })

    await expect(getMobileMyRoomRole({ rpc } as never, roomId)).resolves.toBeNull()
  })
})
```

Run: `pnpm --filter @talkhugam/mobile exec vitest run src/entities/reading-room/mobileRoomDetail.test.ts`
Expected: FAIL — `getMobileMyRoomRole` export 없음.

- [ ] **Step 9: 모바일 역할 조회 구현** — `apps/mobile/src/entities/reading-room/mobileRoomDetail.ts`

domain import에 `parseRoomRole`, `type RoomRole`을 추가하고 `getMobileReadingRoomDetail` 아래에 추가:

```ts
/** 현재 회원의 활성 책방 역할을 서버 RPC로 조회하고, 활성 멤버가 아니면 null을 반환한다. */
export async function getMobileMyRoomRole(client: SupabaseClient, roomId: string): Promise<RoomRole | null> {
  const response = await client.rpc('get_my_room_role', { p_room_id: z.string().uuid().parse(roomId) })

  if (response.error) throw response.error
  return parseRoomRole(response.data)
}
```

`apps/mobile/src/entities/reading-room/index.ts`:

```ts
export {
  getMobileBookChats,
  getMobileDiscussionBookChat,
  getMobileMyRoomRole,
  getMobileReadingRoomDetail,
} from './mobileRoomDetail'
```

- [ ] **Step 10: 모바일 책방 상세 실패 테스트** — `apps/mobile/tests/RoomDetailScreen.test.tsx`

import와 mock 핸들을 추가한다:

```ts
import {
  getMobileBookChats,
  getMobileMyRoomRole,
  getMobileReadingRoomDetail,
} from '../src/entities/reading-room'
```

```ts
const mockGetMobileMyRoomRole = jest.mocked(getMobileMyRoomRole)
```

`beforeEach`에 기본 역할을 넣는다:

```ts
    mockGetMobileMyRoomRole.mockResolvedValue('member')
```

기존 `offers a member-scoped action to add the first book conversation` 테스트의 render 전에 `mockGetMobileMyRoomRole.mockResolvedValue('owner')`를 추가하고, 이름을 `offers owners the action to add the first book conversation`으로 바꾼다. 테스트를 하나 추가한다:

```ts
  it('hides the add-book action from regular members', async () => {
    mockGetMobileReadingRoomDetail.mockResolvedValue({ description: null, id: roomId, name: '금요일 아침 책방' })
    mockGetMobileBookChats.mockResolvedValue([])
    mockGetMobileMyRoomRole.mockResolvedValue('member')

    render(
      <MobileRoomDetailScreen onAddBook={jest.fn()} onBack={jest.fn()} onOpenBookChat={jest.fn()} roomId={roomId} />,
      { wrapper: createQueryWrapper() },
    )

    expect(await screen.findByText('아직 함께 읽는 책이 없어요.')).toBeVisible()
    await waitFor(() => expect(mockGetMobileMyRoomRole).toHaveBeenCalledWith({}, roomId))
    expect(screen.queryByRole('button', { name: '새 책 대화 시작' })).toBeNull()
  })
```

Run: `pnpm --filter @talkhugam/mobile exec jest --runInBand tests/RoomDetailScreen.test.tsx`
Expected: 새 테스트 FAIL(버튼이 보이고 역할 조회가 호출되지 않음).

- [ ] **Step 11: 모바일 책방 상세 구현** — `apps/mobile/src/features/reading-room/MobileRoomDetailScreen.tsx`

import:

```ts
import {
  bookChatKeys,
  canManageRoomContent,
  roomRoleKeys,
  type BookChat,
  type ReadingRoomDetail,
  type RoomRole,
} from '@talkhugam/domain'

import { getMobileBookChats, getMobileMyRoomRole, getMobileReadingRoomDetail } from '../../entities/reading-room'
```

`bookChatsQuery` 선언 아래에 추가:

```ts
  /** 방 접근이 확인된 뒤 현재 회원의 역할을 조회해 책 추가 버튼 노출을 정한다. */
  async function fetchMyRole(): Promise<RoomRole | null> {
    if (roomId === null) return null
    return getMobileMyRoomRole(createMobileSupabaseClient(), roomId)
  }

  const roleQuery = useQuery({
    enabled: roomId !== null && roomQuery.data !== null && roomQuery.data !== undefined,
    queryFn: fetchMyRole,
    queryKey: roomRoleKeys.mine(roomId ?? 'invalid-room'),
  })
```

버튼 조건:

```tsx
            {onAddBook && canManageRoomContent(roleQuery.data ?? null) ? (
              <SecondaryAction label="새 책 대화 시작" onPress={onAddBook} />
            ) : null}
```

빈 상태 안내 문구:

```tsx
      <Text style={styles.stateText}>방장이나 운영자가 첫 책을 추가하면 여기에서 대화를 시작할 수 있어요.</Text>
```

- [ ] **Step 12: 통과 확인**

Run:
```bash
cd /Users/jmg/Desktop/talkhugam-talk-109
pnpm --filter @talkhugam/web exec vitest run src/entities/room-management src/pages/rooms/RoomDetailPage.test.tsx
pnpm --filter @talkhugam/mobile exec vitest run src/entities/reading-room
pnpm --filter @talkhugam/mobile exec jest --runInBand tests/RoomDetailScreen.test.tsx tests/BookDiscoveryRoute.test.tsx
pnpm typecheck:web && pnpm typecheck:mobile && pnpm docs:functions:web
```
Expected: 모두 PASS.

- [ ] **Step 13: 커밋하고 CI 확인**

```bash
cd /Users/jmg/Desktop/talkhugam-talk-109
git add supabase/migrations/20261027000500_restrict_book_chat_creation_to_managers.sql \
  supabase/tests/database/245_room_manager_book_chat_creation.test.sql \
  apps/web/src/entities/room-management apps/web/src/pages/rooms/RoomDetailPage.tsx \
  apps/web/src/pages/rooms/RoomDetailPage.test.tsx apps/web/e2e/ui-health.spec.ts \
  apps/mobile/src/entities/reading-room apps/mobile/src/features/reading-room/MobileRoomDetailScreen.tsx \
  apps/mobile/tests/RoomDetailScreen.test.tsx
git commit -m "feat(rooms): 책 대화 추가를 방장과 운영자로 제한"
git push
GH_CONFIG_DIR=$HOME/.config/gh-talkhugam gh pr checks --watch
```

Expected: 백엔드 CI의 `245_…`와 기존 `060_books_and_chats`(방장이 호출) PASS, 프론트엔드 CI의 「브라우저 UI 검사」에서 `renders room detail command controls with SEED components` PASS.

---

### Task 7: 문서, 전체 검증, PR 정리

**Files:**
- Modify: `openwiki/product-flows.md`, `openwiki/security-operations.md`
- Modify: `docs/superpowers/plans/2026-10-26-room-experience-rebuild.md` (로드맵 표 2단계 행의 「상세 계획」 칸)

**Interfaces:**
- Consumes: T1~T6 결과
- Produces: 없음

- [ ] **Step 1: 제품 흐름 문서 갱신** — `openwiki/product-flows.md`

「## 3. 책 선택과 책 대화」 첫 문단의 첫 문장을 다음으로 바꾼다:

```markdown
책방 상세에서 책을 추가하려면 `/rooms/:roomId/books/new`의 검색 화면을 사용한다. 책 추가(「새 책」)와 책 대화 상태 변경은 방장과 운영자만 할 수 있고, 참여자에게는 버튼 대신 「방장이나 운영자가 첫 책을 고르면…」 안내가 보인다(참여자의 책 제안은 4단계).
```

초대 문단을 다음으로 바꾼다:

```markdown
방장과 운영자는 입력창 옆 `+` 메뉴의 `책방 초대하기`에서 초대 코드와 링크를 만들고 카카오톡·문자·인스타그램·페이스북 또는 복사로 공유할 수 있다. 같은 공유 시트는 `/rooms/:roomId/manage`의 초대 코드 만들기 뒤에도 바로 열린다. 참여자는 같은 메뉴의 `초대 요청`으로 방장과 운영자 모두에게 요청을 보내며, 받은 사람은 인앱 알림에서 방 관리 화면으로 바로 이동해 초대 코드를 만들 수 있다. 인스타그램은 웹에서 메시지 자동 입력을 지원하지 않아 먼저 문구를 복사한 뒤 앱에서 붙여 넣도록 안내한다.
```

「## 5. 책방과 책 대화 관리」의 두 문단을 다음으로 바꾼다:

```markdown
책방 역할은 방장(`owner`)·운영자(`manager`)·멤버(`member`) 세 가지다. 방장과 운영자는 `/rooms/:roomId/manage`에서 초대 코드를 만들고, 방장만 `/rooms/:roomId/manage/settings`의 설정, 멤버 내보내기, 방장 이양, 역할 변경(`update_room_member_role`), 책방 보관·삭제를 다룬다. 멤버 목록은 역할을 「방장」「운영자」「멤버」로 표시한다. 역할 변경 화면은 3단계 「방 정보」 허브에서 추가한다. 개별 책 대화의 관리 화면은 `/rooms/:roomId/books/:bookChatId/manage`다. 멤버 프로필은 `/rooms/:roomId/members/:profileId`에서 볼 수 있다.

역할 권한은 화면 버튼만으로 보호하지 않는다. 콘텐츠 권한(초대 생성·폐기, 책 대화 추가·상태 변경)은 `private.can_manage_room_content`, 방장 전용 권한은 `private.is_room_owner`와 각 RPC가 확인한다. 오픈 책방 자유 채팅에서는 방장이 방장 외 멤버를, 운영자가 참여자만 「퇴장·차단」할 수 있다. 관리 화면을 고칠 때는 UI 조건뿐 아니라 [보안과 운영](./security-operations.md)의 RPC 권한 계약과 pgTAP 검증을 갱신한다.
```

(Task 6을 건너뛴 경우 「책 추가(「새 책」)와 …4단계)」 문장과 「책 대화 추가·」 표현을 빼고 「책 대화 상태 변경」만 남긴다.)

- [ ] **Step 2: 보안 문서 갱신** — `openwiki/security-operations.md`

「## 데이터 접근과 RPC」의 `remove_room_member` 예시 문단 뒤에 추가:

```markdown
책방 역할은 `member_role` enum의 `owner`·`manager`·`member`다. [`20261027000200_add_room_manager_permissions.sql`](../supabase/migrations/20261027000200_add_room_manager_permissions.sql)의 `private.can_manage_room_content`가 「활성 방장 또는 운영자」를 판별하고, 초대 생성·폐기·초대 목록 RLS·책 대화 상태 변경(`20261027000300`), 오픈 책방 제재(`20261027000400`), 책 대화 추가(`20261027000500`)가 이 helper 또는 같은 역할 조건을 쓴다. 방장 전용 동작(설정 수정 RLS, `remove_room_member`, `transfer_room_ownership`, `delete_reading_room`, `update_room_member_role`)은 `private.is_room_owner` 또는 `role = 'owner'` 조건을 그대로 쓴다. 비활성 멤버 행은 `room_members_inactive_owner_forbidden` check 때문에 항상 `member` 역할로 되돌려야 하므로, 멤버를 비활성화하는 새 RPC는 `role = 'member'`를 함께 설정한다. 허용·거부 행렬은 `supabase/tests/database/235`·`240`·`245`·`250` pgTAP이 고정한다.
```

- [ ] **Step 3: 로드맵 표 갱신** — `docs/superpowers/plans/2026-10-26-room-experience-rebuild.md`의 2단계 행 마지막 칸을 `` `2026-10-26-stage2-room-manager-role.md` ``로 바꾼다.

- [ ] **Step 4: Product Hub 갱신** — Notion `Talk후감 Product Hub · Phase 1` > `10. Phase 1 최신 기준 · 사용자 흐름 · 출시 체크`의 책방 권한 항목에 Step 1의 「책방 역할」 문단을 옮긴다. Notion 접근 권한이 없으면 PR 본문 「관련 문서」에 「Product Hub 갱신 필요(운영자 역할 문단)」를 남기고 사용자에게 알린다.

- [ ] **Step 5: 전체 검증**

Run:
```bash
cd /Users/jmg/Desktop/talkhugam-talk-109
pnpm format:web
pnpm lint:web
pnpm typecheck:web
pnpm docs:functions:web
pnpm test:web
pnpm build:web
pnpm typecheck:mobile
pnpm test:mobile
pnpm --filter @talkhugam/domain test
git status --short
```
Expected: 모든 명령 exit 0. `format:web`이 파일을 고쳤다면 그 변경을 커밋에 포함한다.

- [ ] **Step 6: 커밋과 PR 본문 작성**

```bash
cd /Users/jmg/Desktop/talkhugam-talk-109
git add openwiki/product-flows.md openwiki/security-operations.md docs/superpowers/plans/2026-10-26-room-experience-rebuild.md
git commit -m "docs(rooms): 운영자 역할 권한 흐름 문서화"
git push
```

`.github/pull_request_template.md` 형식으로 본문을 저장소 밖 임시 파일(예: `"$TMPDIR/talk-109-pr-body.md"`)에 저장한다. 저장소 안에 본문 파일을 커밋하지 않는다.

```markdown
## 작업 이유

책방 경험 재구현 2단계. 방장 혼자 하던 초대·책 관리·오픈 책방 제재를 운영자(`manager`)와 나눌 수 있도록 역할과 서버 권한 규칙을 추가한다(로드맵 「2단계 계약」).

## 변경 내용

- DB: `member_role`에 `manager` 추가, `private.can_manage_room_content`, `update_room_member_role`(방장 전용), `get_my_room_role` 추가
- 비공개 책방: 초대 생성·폐기·초대 목록 RLS·책 대화 상태 변경을 방장·운영자로, 초대 요청 알림을 방장+운영자에게
- 오픈 책방: 운영자 제재(참여자만), 상세·채팅 조회 RPC에 역할 필드
- 책 대화 추가를 방장·운영자로 제한(참여자 제안은 4단계)
- 도메인 `roomPermission.ts`, 웹·모바일 schema가 `manager`를 받도록 확장, 역할 표기 「운영자」, 초대·제재·새 책 버튼 노출 규칙
- 방장 전용 유지: 설정, 내보내기, 이양, 삭제, 역할 변경
- 역할 변경 알림은 만들지 않음(3단계에서 결정)

## 검증

- pgTAP(CI): 235·240·245·250 신규, 130·145·225 갱신
- `pnpm format:web` / `lint:web` / `typecheck:web` / `docs:functions:web` / `test:web` / `build:web` / `typecheck:mobile` / `test:mobile` / `@talkhugam/domain test` 통과
- Playwright `ui-health` CI 통과
- 자동화하지 못한 범위: 운영자 계정의 320px·640px 실제 화면(방 관리 단일 버튼 배치, 빈 책방 안내 줄바꿈)

## 데이터·보안

- [x] DB 변경은 migration으로 기록했다.
- [x] RLS 허용·거부 케이스를 확인했다.
- [x] Secret, 개인정보, 채팅 본문, 영상 URL을 노출하지 않는다.
- [ ] 해당 없음인 경우 이유를 본문에 적었다.

## 관련 티켓

TALK-109

## 확인 목록

- [x] PR 제목은 `<type>(<scope>): <한글 요약>` 형식이다.
- [x] 본문과 리뷰 답변은 기술 고유명사를 제외하고 한글로 작성했다.
- [x] 티켓 완료 기준을 충족한다.
- [x] 모든 함수에 입력·책임·반환을 설명하는 한글 JSDoc을 작성했다.
- [x] 함수의 제어 흐름 depth가 2 이하이다.
- [x] 순수 로직과 부수 효과 경계를 분리했다.
- [ ] 관련 문서와 Notion 상태를 갱신했다.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

```bash
GH_CONFIG_DIR=$HOME/.config/gh-talkhugam gh pr edit --body-file "$TMPDIR/talk-109-pr-body.md"
GH_CONFIG_DIR=$HOME/.config/gh-talkhugam gh pr checks --watch
```

Expected: 「백엔드 CI」·「프론트엔드 CI」 모든 job PASS. 통과 후 `GH_CONFIG_DIR=$HOME/.config/gh-talkhugam gh pr ready`로 draft를 해제한다(병합은 사용자 결정).

---

## 자체 점검 결과

- **계약 대비:** enum(T1), `can_manage_room_content`(T1), `update_room_member_role`(T1, 방장 전용·`owner` 금지), 비공개 책방 초대·초대 요청·책 대화 추가·보관(T2, T6), 오픈 책방 제재와 운영자 간 제재 금지(T3), 하드코딩 감사표(본문), 도메인·웹·모바일 schema·라벨·버튼(T4, T5, T6), pgTAP 행렬 owner × manager × member × outsider(235·240·245·250), 문서·PR(T7). 계약의 「초대 요청 승인·거절」은 해당 RPC가 없어 「요청 수신자 확대」로 해석했다(결정 사항).
- **이름 일관성:** `canCurrentUserManageContent`, `currentUserRole`, `currentMemberRole`, `senderRole`, `getMyRoomRole`, `getMobileMyRoomRole`, `roomRoleKeys.mine`, `canCreateRoomInvite`를 모든 태스크에서 같은 철자로 썼다.
- **pgTAP plan 수:** 235=37, 240=23, 245=8, 250=14. 테스트를 고치면 `select plan(n)`도 같이 고친다.
