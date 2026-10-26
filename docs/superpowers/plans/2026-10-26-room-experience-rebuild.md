# 책방 경험 재구현 계획 (talk-103 대체)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 열린 PR #102(talk-103)의 책방 경험을 최신 main 위에서 기능 단위 PR로 다시 만들고, 진행률·완독 기능은 제거하고 별점만 남긴다.

**Architecture:** talk-103 브랜치는 병합하지 않고 참고용으로만 읽는다(`git show feat/talk-103-room-experience:<path>`). DB 권한은 모두 PostgreSQL RPC에서 재검증하고, 웹과 Expo 모바일은 `@talkhugam/domain`의 공용 파서·키를 공유한다. 단계마다 독립 PR 하나로 끝낸다.

**Tech Stack:** React 19, TypeScript strict, TanStack Query, `@seed-design/react`, Expo, Supabase PostgreSQL RPC/RLS, Zod, Vitest, Jest(모바일 화면), Playwright, pgTAP.

## 결정 사항 (2026-10-26 사용자 확인)

| 항목 | 결정 |
| --- | --- |
| 개인 진행률(쪽수·퍼센트) | 웹·모바일·DB에서 모두 제거 |
| 완독(완독 처리, 완독 배지, 완독 알림) | 모두 제거 |
| 별점 | 유지. 기존 완독 기록의 별점·총평을 「별점 기록」으로 전환 |
| 독후감(책 대화 글, `posts`) | 영향 없음 |
| 운영자 역할 | 비공개 책방과 오픈 책방 모두에 둔다 |
| 책 제안 요청 | 만든다 |
| 게시글 반응 | 넣는다 |

## Global Constraints

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

## 단계 로드맵

| 단계 | 티켓·브랜치 | 내용 | 상세 계획 |
| --- | --- | --- | --- |
| 1 | `refactor/talk-108-remove-progress-completion` | 진행률·완독 제거, 별점 기록 전환 | 이 문서 「1단계」 |
| 2 | `feat/talk-109-room-manager-role` | 운영자 역할 DB·권한·도메인 (비공개+오픈 책방) | 이 문서 「2단계 계약」, 착수 시 상세화 |
| 3 | `feat/talk-110-room-info-hub` | 「방 정보」 허브, 구성원 역할 변경 UI (웹·모바일) | 착수 시 상세화 |
| 4 | `feat/talk-111-book-proposals` | 책 제안 요청과 승인 | 이 문서 「4단계 계약」, 착수 시 상세화 |
| 5 | `feat/talk-112-post-reactions` | 게시글 반응 (웹·모바일) | 이 문서 「5단계 계약」, 착수 시 상세화 |
| 6 | `feat/talk-113-room-video-archive` | 책방 전체 영상 기록, `+` 메뉴 정리 | 착수 시 상세화 |

1단계를 먼저 하는 이유: talk-103의 독서 상태 UI(`ReadingStatus`)와 `+` 메뉴의 완독 항목이 사라져 이후 단계의 변경 범위가 줄어든다.

---

## 1단계: 진행률·완독 제거와 별점 기록 전환

### 파일 구조

**DB**
- Create: `supabase/migrations/<작업일>000100_replace_completions_with_ratings.sql`: 백업, 테이블 전환, RPC 교체, 진행률 제거
- Create: `supabase/tests/database/230_book_chat_ratings.test.sql`
- Delete: `supabase/tests/database/150_book_chat_completions.test.sql`, `supabase/tests/database/190_book_chat_reading_progresses.test.sql`
- Modify: `supabase/tests/database/130_rls_audit.test.sql` (공개 테이블 26 → 25, 목록의 `book_chat_reading_progresses` 제거, `book_chat_completions` → `book_chat_ratings`)
- Modify: `supabase/tests/database/145_function_comments.test.sql` (함수 목록 교체)
- Modify: `supabase/tests/database/175_book_activity_notifications.test.sql` (완독 알림 케이스 삭제)

**공용 도메인**
- Create: `packages/domain/src/bookRating.ts`, `packages/domain/src/bookRating.test.ts`
- Delete: `packages/domain/src/bookCompletion.ts`, `packages/domain/src/bookCompletion.test.ts`
- Modify: `packages/domain/src/index.ts`

**웹**
- Create: `apps/web/src/entities/book-rating/{bookRating.ts,bookRating.test.ts,index.ts}`
- Create: `apps/web/src/features/book-rating/{RatingForm.tsx,RatingForm.test.tsx,bookRatingCache.ts,bookRatingCache.test.ts,index.ts}`
- Create: `apps/web/src/shared/ui/RatingStars.tsx`, `apps/web/src/shared/ui/RatingStars.test.tsx`
- Delete: `apps/web/src/entities/book-completion/`, `apps/web/src/entities/reading-progress/`, `apps/web/src/features/book-completion/`, `apps/web/src/shared/ui/CompletionMark.tsx`, `apps/web/src/shared/ui/CompletionMark.test.tsx`, `apps/web/public/brand/talkhugam-completion.svg`(다른 참조가 없을 때)
- Modify: `apps/web/src/pages/rooms/RoomDetailPage.tsx`, `BookChatManagementPage.tsx`, `BookDiscussionPage.tsx` 및 각 `.test.tsx`
- Modify: `apps/web/src/pages/profile/MyReadingBooksPage.tsx`, `MyReadingBooksPage.test.tsx`, `ProfilePage.tsx`, `ProfilePage.test.tsx`
- Modify: `apps/web/e2e/ui-health.spec.ts` (진행률·완독 흐름과 목 응답 제거, 별점 흐름 추가)

**모바일**
- Create: `apps/mobile/src/entities/book-rating/{mobileBookRating.ts,mobileBookRating.test.ts,index.ts}`
- Delete: `apps/mobile/src/entities/book-completion/`
- Modify: `apps/mobile/src/features/reading-room/MobileBookDiscussionScreen.tsx`, `apps/mobile/tests/MobileBookDiscussionScreen.test.tsx`

**문서**
- Modify: `openwiki/product-flows.md`, `openwiki/` 내 완독·진행률 언급 페이지(`grep -rn "완독\|진행률" openwiki`로 확인)
- Modify: `apps/web/src/entities/legal/legalDocument.ts`: 개인정보처리방침에 완독·진행률 수집 항목이 있으면 별점으로 바꾸고, 문서 버전을 올린다(`grep -n "완독\|진행" apps/web/src/entities/legal/legalDocument.ts`)

### 데이터 전환 규칙

- 원본 `book_chat_completions` 전체를 `private.book_chat_completions_backup_20261026`로 복사한다. 앱에서는 보이지 않는다.
- 진행률 원본 `book_chat_reading_progresses`도 `private.book_chat_reading_progresses_backup_20261026`로 복사한 뒤 테이블을 삭제한다.
- `book_chat_completions`를 `book_chat_ratings`로 이름을 바꾸고, `rating is null`인 행(별점 없이 완독만 한 기록)은 삭제한다. 백업에는 남는다.
- `completed_at` 컬럼은 삭제한다. 정렬 기준은 `updated_at`이다.
- `rating`은 `not null`, 1~5. 총평(`review`)은 선택이고 최대 1000자.
- 알림 종류 `completion`의 기존 알림과 푸시 대기열 행은 삭제한다. enum 값은 PostgreSQL에서 지울 수 없으니 남겨 두고, 별점 저장은 알림을 만들지 않는다.

### Task 1: DB 전환과 pgTAP

**Files:**
- Create: `supabase/migrations/<작업일>000100_replace_completions_with_ratings.sql`
- Create: `supabase/tests/database/230_book_chat_ratings.test.sql`
- Delete/Modify: 위 「DB」 목록의 테스트 파일

**Interfaces:**
- Produces: 테이블 `public.book_chat_ratings(id, book_chat_id, profile_id, rating smallint not null, review text, created_at, updated_at)`
- Produces: `public.upsert_book_chat_rating(p_book_chat_id uuid, p_rating smallint, p_review text default null) returns void`
- Produces: `public.remove_book_chat_rating(p_book_chat_id uuid) returns void`
- Removes: `upsert_book_chat_completion`, `remove_book_chat_completion`, `upsert_book_chat_reading_progress`, 테이블 `book_chat_reading_progresses`

- [ ] **Step 1: 실패하는 pgTAP 작성** (`230_book_chat_ratings.test.sql`)

```sql
begin;

\ir ../helpers/auth.inc

select plan(14);

select has_table('public', 'book_chat_ratings', '별점 테이블이 존재해야 한다');
select hasnt_table('public', 'book_chat_completions', '완독 테이블은 제거되어야 한다');
select hasnt_table('public', 'book_chat_reading_progresses', '진행률 테이블은 제거되어야 한다');
select hasnt_column('public', 'book_chat_ratings', 'completed_at', '별점 기록에는 완독일이 없어야 한다');
select col_not_null('public', 'book_chat_ratings', 'rating', '별점은 필수여야 한다');
select hasnt_function('public', 'upsert_book_chat_completion', '완독 저장 함수는 제거되어야 한다');
select hasnt_function('public', 'upsert_book_chat_reading_progress', '진행률 저장 함수는 제거되어야 한다');

select tests.create_supabase_user('00000000-0000-0000-0000-000000000301', 'rating-owner@test.local', '별점 방장');
select tests.create_supabase_user('00000000-0000-0000-0000-000000000302', 'rating-stranger@test.local', '별점 외부');

insert into public.reading_rooms (id, name, created_by)
values ('10000000-0000-0000-0000-000000000301', '별점 테스트 모임', '00000000-0000-0000-0000-000000000301');
-- 방장 멤버, 책, 책 대화 준비는 150_book_chat_completions.test.sql의 준비 구간(INSERT 문)을 같은 ID 체계(…0301)로 옮겨 쓴다.

select tests.authenticate_as('00000000-0000-0000-0000-000000000301');
set local role authenticated;

select throws_ok(
  $$select public.upsert_book_chat_rating('30000000-0000-0000-0000-000000000301', null::smallint, null)$$,
  'P0001', 'VALIDATION_FAILED', '별점 없이 저장할 수 없어야 한다'
);
select lives_ok(
  $$select public.upsert_book_chat_rating('30000000-0000-0000-0000-000000000301', 4::smallint, '좋았어요')$$,
  '활성 멤버는 별점을 저장할 수 있어야 한다'
);
select lives_ok(
  $$select public.upsert_book_chat_rating('30000000-0000-0000-0000-000000000301', 5::smallint, null)$$,
  '같은 책의 별점은 수정되어야 한다'
);
select results_eq(
  $$select rating, review from public.book_chat_ratings where book_chat_id = '30000000-0000-0000-0000-000000000301'$$,
  $$values (5::smallint, null::text)$$,
  '별점과 총평이 마지막 값으로 바뀌어야 한다'
);

reset role;
select is(
  (select count(*) from public.notifications where type = 'completion'),
  0::bigint,
  '별점 저장은 알림을 만들지 않아야 한다'
);

select tests.authenticate_as('00000000-0000-0000-0000-000000000302');
set local role authenticated;
select throws_ok(
  $$select public.upsert_book_chat_rating('30000000-0000-0000-0000-000000000301', 3::smallint, null)$$,
  'P0001', 'ROOM_FORBIDDEN', '책방 멤버가 아니면 별점을 남길 수 없어야 한다'
);

reset role;
select * from finish();

rollback;
```

- [ ] **Step 2: 실패 확인**: 로컬 Supabase가 있으면 `pnpm backend:reset && pnpm backend:test:db`, 없으면 push 후 CI 「데이터베이스 migration과 RLS 검사」. 기대 결과: `book_chat_ratings` 없음으로 실패.

- [ ] **Step 3: 마이그레이션 작성**

```sql
create table private.book_chat_completions_backup_20261026 as
select * from public.book_chat_completions;

create table private.book_chat_reading_progresses_backup_20261026 as
select * from public.book_chat_reading_progresses;

revoke all on table private.book_chat_completions_backup_20261026 from public, anon, authenticated;
revoke all on table private.book_chat_reading_progresses_backup_20261026 from public, anon, authenticated;

drop function if exists public.upsert_book_chat_reading_progress(uuid, integer, integer);
drop table public.book_chat_reading_progresses;

drop function if exists public.upsert_book_chat_completion(uuid, smallint, text);
drop function if exists public.remove_book_chat_completion(uuid);

delete from public.book_chat_completions where rating is null;

alter table public.book_chat_completions rename to book_chat_ratings;
alter table public.book_chat_ratings drop column completed_at;
alter table public.book_chat_ratings alter column rating set not null;
alter table public.book_chat_ratings
  rename constraint book_chat_completions_book_chat_profile_unique to book_chat_ratings_book_chat_profile_unique;
alter table public.book_chat_ratings
  rename constraint book_chat_completions_rating_range to book_chat_ratings_rating_range;
alter table public.book_chat_ratings
  rename constraint book_chat_completions_review_length to book_chat_ratings_review_length;
alter trigger book_chat_completions_set_updated_at on public.book_chat_ratings
  rename to book_chat_ratings_set_updated_at;
alter policy book_chat_completions_select_own_or_room_member on public.book_chat_ratings
  rename to book_chat_ratings_select_own_or_room_member;

create index book_chat_ratings_profile_updated_at_idx
on public.book_chat_ratings (profile_id, updated_at desc);

delete from public.notification_push_outbox
where notification_id in (select id from public.notifications where type = 'completion');
delete from public.notifications where type = 'completion';

create or replace function public.upsert_book_chat_rating(
  p_book_chat_id uuid,
  p_rating smallint,
  p_review text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_chat public.book_chats%rowtype;
  v_review text := nullif(btrim(p_review), '');
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  if p_rating is null or p_rating not between 1 and 5 or char_length(coalesce(v_review, '')) > 1000 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  select * into v_chat
  from public.book_chats
  where book_chats.id = p_book_chat_id and book_chats.deleted_at is null
  for update;

  if v_chat.id is null then
    raise exception using errcode = 'P0001', message = 'BOOK_CHAT_NOT_FOUND';
  end if;

  if v_chat.status = 'archived' then
    raise exception using errcode = 'P0001', message = 'BOOK_CHAT_ARCHIVED';
  end if;

  if not private.is_active_room_member(v_chat.room_id) then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  insert into public.book_chat_ratings (book_chat_id, profile_id, rating, review)
  values (p_book_chat_id, auth.uid(), p_rating, v_review)
  on conflict (book_chat_id, profile_id)
  do update set rating = excluded.rating, review = excluded.review, updated_at = now();
end;
$$;

create or replace function public.remove_book_chat_rating(p_book_chat_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_chat public.book_chats%rowtype;
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  select * into v_chat
  from public.book_chats
  where book_chats.id = p_book_chat_id and book_chats.deleted_at is null
  for update;

  if v_chat.id is null then
    raise exception using errcode = 'P0001', message = 'BOOK_CHAT_NOT_FOUND';
  end if;

  if v_chat.status = 'archived' then
    raise exception using errcode = 'P0001', message = 'BOOK_CHAT_ARCHIVED';
  end if;

  if not private.is_active_room_member(v_chat.room_id) then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  delete from public.book_chat_ratings
  where book_chat_ratings.book_chat_id = p_book_chat_id
    and book_chat_ratings.profile_id = auth.uid();
end;
$$;

revoke all on function public.upsert_book_chat_rating(uuid, smallint, text) from public, anon;
revoke all on function public.remove_book_chat_rating(uuid) from public, anon;
grant execute on function public.upsert_book_chat_rating(uuid, smallint, text) to authenticated;
grant execute on function public.remove_book_chat_rating(uuid) to authenticated;

comment on function public.upsert_book_chat_rating(uuid, smallint, text) is
  '활성 책방 멤버의 책 별점과 선택 총평을 저장하거나 수정하며 보관된 책 대화 변경을 거부한다.';
comment on function public.remove_book_chat_rating(uuid) is
  '활성 책방 멤버가 자신의 책 별점 기록을 삭제하며 보관된 책 대화 변경을 거부한다.';
```

마이그레이션 작성 전에 확인할 것: `private.is_active_room_member`의 존재(`grep -n "function private.is_active_room_member" supabase/migrations/*.sql`), 기존 인덱스 `book_chat_completions_profile_completed_at_idx`가 `completed_at` 삭제와 함께 사라지는지(컬럼 삭제 시 함께 삭제됨), 계정 삭제·리소스 삭제 함수(`110`, `120` 테스트 대상)가 `book_chat_completions`·`book_chat_reading_progresses`를 이름으로 참조하는지(`grep -rn "book_chat_completions\|book_chat_reading_progresses" supabase/migrations | grep -v 2026071`). 참조가 있으면 같은 마이그레이션에서 해당 함수를 `create or replace`로 다시 정의한다.

- [ ] **Step 4: 기존 테스트 정리**: `150`, `190` 삭제, `130`의 기대값 26 → 25와 문구 `twenty-five`, 테이블 목록 수정, `145`의 함수 목록에서 세 함수를 지우고 `upsert_book_chat_rating`, `remove_book_chat_rating` 추가, `175`의 완독 알림 케이스(`upsert_book_chat_completion` 호출부와 `type = 'completion'` 기대값)를 삭제하고 `plan()` 숫자를 맞춘다.

- [ ] **Step 5: 통과 확인**: Step 2와 같은 명령. 기대 결과: 전체 pgTAP 통과.

- [ ] **Step 6: Commit**: `feat(db): 완독·진행률을 별점 기록으로 전환`

### Task 2: 공용 도메인 `bookRating`

**Files:** Create `packages/domain/src/bookRating.ts`, `bookRating.test.ts`; Delete `bookCompletion.ts`, `bookCompletion.test.ts`; Modify `index.ts`

**Interfaces:**
- Produces:
  - `bookRatingKeys.byChat(bookChatId)` → `['book-ratings', bookChatId]`
  - `bookRatingKeys.myBooks(profileId)` → `['my-rated-books', profileId]`
  - `type BookChatRating = { avatarPath: string | null; displayName: string; isMe: boolean; profileId: string; rating: number; review: string | null; updatedAt: string }`
  - `type RatedBook = { authors: string[]; bookChatId: string; rating: number; review: string | null; roomId: string; thumbnailUrl: string | null; title: string; updatedAt: string }`
  - `type BookRatingInput = { bookChatId: string; rating: number; review: string | null }`
  - `parseBookChatRatings(value: unknown, currentProfileId: string): BookChatRating[]`
  - `parseRatedBooks(value: unknown): RatedBook[]`
  - `parseBookRatingInput(value: unknown): BookRatingInput`
  - `calculateAverageRating(ratings: Pick<BookChatRating, 'rating'>[]): number | null` (소수 첫째 자리 반올림)

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { describe, expect, it } from 'vitest'

import {
  bookRatingKeys,
  calculateAverageRating,
  parseBookChatRatings,
  parseBookRatingInput,
  parseRatedBooks,
} from './bookRating'

const me = '00000000-0000-0000-0000-000000000001'
const other = '00000000-0000-0000-0000-000000000002'

describe('bookRating', () => {
  it('책방 표시명을 우선해 별점 목록을 변환한다', () => {
    const ratings = parseBookChatRatings(
      [
        {
          book_chats: { room_members: [{ profile_id: me, room_avatar_path: null, room_display_name: '책방 이름' }] },
          profile_id: me,
          profiles: { avatar_path: null, display_name: '기본 이름' },
          rating: 4,
          review: null,
          updated_at: '2026-10-26T10:00:00+09:00',
        },
      ],
      me,
    )

    expect(ratings).toEqual([
      { avatarPath: null, displayName: '책방 이름', isMe: true, profileId: me, rating: 4, review: null, updatedAt: '2026-10-26T10:00:00+09:00' },
    ])
  })

  it('별점이 없는 저장 요청을 거부한다', () => {
    expect(() => parseBookRatingInput({ bookChatId: me, rating: null, review: null })).toThrow()
  })

  it('1~5 밖의 별점을 거부한다', () => {
    expect(() => parseBookRatingInput({ bookChatId: me, rating: 6, review: null })).toThrow()
  })

  it('평균 별점을 소수 첫째 자리로 반올림하고 빈 목록은 null로 둔다', () => {
    expect(calculateAverageRating([{ rating: 4 }, { rating: 5 }, { rating: 5 }])).toBe(4.7)
    expect(calculateAverageRating([])).toBeNull()
  })

  it('내 별점 책 목록을 변환한다', () => {
    const books = parseRatedBooks([
      {
        book_chat_id: other,
        book_chats: { books: { authors: ['저자'], thumbnail_url: null, title: '책' }, room_id: me },
        rating: 3,
        review: '보통',
        updated_at: '2026-10-26T10:00:00+09:00',
      },
    ])

    expect(books[0]).toMatchObject({ bookChatId: other, rating: 3, roomId: me, title: '책' })
  })

  it('화면별 query key를 분리한다', () => {
    expect(bookRatingKeys.byChat(other)).toEqual(['book-ratings', other])
    expect(bookRatingKeys.myBooks(me)).toEqual(['my-rated-books', me])
  })
})
```

- [ ] **Step 2: 실패 확인**: `pnpm --filter @talkhugam/domain test -- bookRating` → 모듈 없음으로 FAIL.

- [ ] **Step 3: 구현**: `bookCompletion.ts`의 구조를 그대로 따르되 `completed_at` → `updated_at`, `rating`은 `z.number().int().min(1).max(5)`(nullable 아님), `bookCompletionKeys.myBookChatIds`와 `parseBookChatCompletionIds`는 만들지 않는다(완독 표시 용도라 불필요). 평균 함수:

```ts
/** 별점 목록의 평균을 소수 첫째 자리로 반올림해 반환하고, 기록이 없으면 null을 반환한다. */
export function calculateAverageRating(ratings: Pick<BookChatRating, 'rating'>[]): number | null {
  if (ratings.length === 0) return null
  const total = ratings.reduce((sum, item) => sum + item.rating, 0)
  return Math.round((total / ratings.length) * 10) / 10
}
```

`index.ts`에서 `./bookCompletion` export를 지우고 `./bookRating`을 export한다.

- [ ] **Step 4: 통과 확인**: 같은 명령 → PASS. `bookCompletion.ts`, `bookCompletion.test.ts` 삭제.

- [ ] **Step 5: Commit**: `refactor(domain): 완독 모델을 별점 모델로 교체`

### Task 3: 웹 엔티티와 별점 입력 UI

**Files:** Create `apps/web/src/entities/book-rating/*`, `apps/web/src/features/book-rating/*`, `apps/web/src/shared/ui/RatingStars.tsx(+test)`; Delete `entities/book-completion`, `entities/reading-progress`, `features/book-completion`

**Interfaces:**
- Consumes: Task 2의 도메인 export
- Produces:
  - `getBookChatRatings(client, bookChatId, currentProfileId): Promise<BookChatRating[]>`: `from('book_chat_ratings').select('profile_id, rating, review, updated_at, profiles(display_name, avatar_path), book_chats!inner(room_members(profile_id, room_display_name, room_avatar_path))').eq('book_chat_id', …).order('updated_at')`
  - `getMyRatedBooks(client, profileId): Promise<RatedBook[]>`
  - `upsertBookChatRating(client, input: BookRatingInput): Promise<void>`: RPC `upsert_book_chat_rating`
  - `removeBookChatRating(client, bookChatId): Promise<void>`: RPC `remove_book_chat_rating`
  - `RatingForm({ bookChatId, initialRating, initialReview, isSaving, onCancel, onSave, submitLabel })`: 별점 필수, 총평 선택
  - `storeBookRatingInCache(queryClient, input & { profileId })`, `removeBookRatingFromCache(queryClient, { bookChatId, profileId })`, `invalidateRatingQueries(queryClient, bookChatId, profileId)`
  - `RatingStars({ rating, label? })`: 읽기 전용 별 5개, `aria-label="별점 {n}점"`

- [ ] **Step 1: 실패하는 테스트 작성**
  - `RatingForm.test.tsx`: 별점을 고르기 전에는 저장 버튼이 `disabled`이고, 「4점」 선택 후 총평을 입력해 저장하면 `onSave({ bookChatId, rating: 4, review: '좋아요' })`를 호출한다. 「완독일」 문구는 렌더링되지 않는다.
  - `RatingStars.test.tsx`: `rating={3}`이면 `getByLabelText('별점 3점')`이 있고, 채워진 별 3개와 빈 별 2개를 그린다.
  - `bookRatingCache.test.ts`: 기존 `bookCompletionCache.test.ts`의 저장·제거 케이스를 별점 키(`bookRatingKeys`)로 옮기고, 진행률 캐시 관련 케이스는 삭제한다.
- [ ] **Step 2: 실패 확인**: `pnpm --filter @talkhugam/web test -- book-rating RatingStars` → FAIL.
- [ ] **Step 3: 구현**: `CompletionReviewForm.tsx`를 바탕으로 `RatingForm.tsx`를 만든다. 「별점 (선택)」 → 「별점」, 안내 문구는 「별점은 꼭 골라 주세요. 총평은 선택이에요.」, `rating === null`이면 저장 버튼 `disabled`. 별 아이콘은 기존 `StarIcon`을 쓴다.
- [ ] **Step 4: 통과 확인**: 같은 명령 → PASS.
- [ ] **Step 5: Commit**: `feat(web): 별점 엔티티와 입력 폼 추가`

### Task 4: 웹 화면 전환

**Files:** `RoomDetailPage.tsx`, `BookChatManagementPage.tsx`, `BookDiscussionPage.tsx`, `MyReadingBooksPage.tsx`, `ProfilePage.tsx`, 각 테스트, `CompletionMark.tsx(+test)` 삭제

화면별 변경:

| 화면 | 제거 | 대체 |
| --- | --- | --- |
| 책방 상세 `RoomDetailPage` | 완독 ID 조회, 진행률 조회, `BookChatProgress`, `CompletionMark` | 없음(책 카드에는 제목·저자만) |
| 책 대화 관리 `BookChatManagementPage` | 「내 완독 기록」 카드, 「완독하기」 | 「내 별점」 카드: 별점이 있으면 `RatingStars`와 「수정하기」, 없으면 「별점 남기기」. 시트 제목 「별점 남기기」 |
| 책 대화 `BookDiscussionPage` | 완독 기록 시트(멤버 완독 목록), 완독 취소 | 「별점」 시트: 평균 별점(`calculateAverageRating`)과 멤버별 별점·총평 목록, 내 별점 수정·삭제 |
| 내 책 `MyReadingBooksPage` | 진행률 시트, 진행률 막대, 완독 기록 시트, 완독 책 제외 로직 | 제목 「읽고 있는 책」 → 「내 책」. 참여 책방별 책 목록, 카드마다 내 별점 또는 「별점 남기기」 |
| 내 정보 `ProfilePage` | 설명 「…읽는 책과 완독 기록을 봐요.」 | 「참여한 책방의 책과 내가 남긴 별점을 봐요.」, 메뉴 이름 「내 책」 |

- [ ] **Step 1: 테스트 먼저 수정**: 각 `.test.tsx`에서 진행률·완독 단언과 목을 지우고 다음 단언을 추가한다.
  - `RoomDetailPage.test.tsx`: `queryByLabelText(/독서 진행률/)`와 `queryByText('완독')`이 `null`이다.
  - `BookChatManagementPage.test.tsx`: 별점이 없으면 「별점 남기기」 버튼이 있고, 저장 시 `upsertBookChatRating`이 `{ bookChatId, rating, review }`로 호출된다.
  - `BookDiscussionPage.test.tsx`: 「별점」 시트에 「평균 4.5」와 멤버별 별점이 보인다.
  - `MyReadingBooksPage.test.tsx`: 제목 「내 책」, 별점 없는 책 카드에 「{제목} 별점 남기기」 버튼이 있다. 진행률 입력 필드가 없다.
- [ ] **Step 2: 실패 확인**: `pnpm --filter @talkhugam/web test -- pages/rooms pages/profile` → FAIL.
- [ ] **Step 3: 구현**: 위 표대로 화면을 바꾼다. 삭제 후 `grep -rn "book-completion\|reading-progress\|CompletionMark\|완독\|진행률" apps/web/src`의 결과가 0건이어야 한다(개인정보처리방침 이력 문구 제외).
- [ ] **Step 4: 통과 확인**: `pnpm test:web`, `pnpm typecheck:web`, `pnpm lint:web`, `pnpm docs:functions:web` → 모두 통과.
- [ ] **Step 5: Playwright 정리**: `apps/web/e2e/ui-health.spec.ts`에서 「진행률 기록하기」, 「진행률 저장」 흐름과 진행률 목 응답을 지우고, 책 대화 관리에서 별점 4점을 저장하는 흐름을 추가한다. 320px·640px 스크린숏 검사가 있으면 새 화면 이름으로 갱신한다.
- [ ] **Step 6: Commit**: `refactor(web): 진행률·완독 화면을 별점으로 교체`

### Task 5: 모바일 전환

**Files:** Create `apps/mobile/src/entities/book-rating/*`; Delete `apps/mobile/src/entities/book-completion/`; Modify `MobileBookDiscussionScreen.tsx`, `apps/mobile/tests/MobileBookDiscussionScreen.test.tsx`

**Interfaces:**
- Produces: `getMobileBookChatRatings(client, bookChatId, currentProfileId)`, `upsertMobileBookChatRating(client, input: unknown)`, `removeMobileBookChatRating(client, bookChatId)`: 웹 Task 3과 같은 쿼리·RPC

- [ ] **Step 1: 실패하는 테스트**: `mobileBookRating.test.ts`에서 RPC 이름 `upsert_book_chat_rating`과 인자 `{ p_book_chat_id, p_rating, p_review }`를 확인하고, `MobileBookDiscussionScreen.test.tsx`에서 「완독 기록」 대신 「별점」 시트가 열리고 별점 없이 저장할 수 없는지 확인한다.
- [ ] **Step 2: 실패 확인**: `pnpm test:mobile` → FAIL.
- [ ] **Step 3: 구현**: 화면 상태 이름을 `completion*` → `rating*`으로 바꾸고, 시트 제목·버튼 문구를 웹과 같게 맞춘다(「별점」, 「별점 남기기」, 「수정하기」).
- [ ] **Step 4: 통과 확인**: `pnpm test:mobile`, `pnpm typecheck:mobile` → 통과. `grep -rn "Completion\|완독" apps/mobile/src apps/mobile/app`의 결과가 0건이어야 한다. 알림 enum의 `'completion'`은 기존 데이터 호환을 위해 남긴다.
- [ ] **Step 5: Commit**: `refactor(mobile): 완독 기록을 별점으로 교체`

### Task 6: 문서와 PR

- [ ] `openwiki/product-flows.md` 등에서 진행률·완독 흐름을 별점 흐름으로 고친다.
- [ ] 개인정보처리방침에 진행률·완독 항목이 있으면 문구와 버전을 갱신한다.
- [ ] Product Hub 문안(「진행률·완독 제거, 책별 별점·총평으로 전환」)을 PR 본문에 적는다.
- [ ] Global Constraints의 전체 검사를 실행하고 PR을 연다. 제목: `refactor(rooms): 진행률·완독을 별점 기록으로 전환`.

---

## 2단계 계약: 운영자 역할 (착수 시 상세 계획 작성)

- `member_role`에 `manager` 추가(별도 마이그레이션 파일. enum 값 추가는 같은 트랜잭션에서 쓸 수 없다).
- `private.can_manage_room_content(p_room_id uuid) returns boolean`: 현재 사용자가 해당 방의 활성 `owner` 또는 `manager`인지 반환한다.
- `public.update_room_member_role(p_room_id uuid, p_member_id uuid, p_role public.member_role)`: 방장만 실행할 수 있다. `owner`로는 바꿀 수 없다(방장 이양은 기존 흐름 사용).
- 비공개 책방: 초대 생성·폐기, 초대 요청 승인·거절(#100), 책 대화 추가·보관을 방장과 운영자에게 허용한다. #105의 `create_room_invite`(비공개 책방만 허용) 정의를 기준으로 역할 검사만 넓힌다.
- 오픈 책방: `ban_community_member`를 방장과 운영자에게 허용한다. 단 운영자는 방장과 다른 운영자를 제재할 수 없다. 책 대화 추가 권한도 비공개 책방과 같게 맞춘다.
- 참고 코드: `git show feat/talk-103-room-experience:supabase/migrations/20260802000200_add_room_manager_permissions.sql`, `…:supabase/tests/database/170_room_manager_permissions.test.sql`, `…:apps/web/src/entities/room-permission/`.
- pgTAP: 방장·운영자·참여자 × (초대, 책 추가, 역할 변경, 제재)의 허용·거부 행렬.

## 4단계 계약: 책 제안 요청 (착수 시 상세 계획 작성)

- 테이블 `public.room_book_proposals(id, room_id, proposer_member_id, book_id references books, note text, status text check in ('pending','approved','rejected'), resolved_by_member_id, resolved_at, created_at)`. 같은 방·같은 책의 `pending`은 하나만 둔다(부분 유니크 인덱스).
- RPC `create_room_book_proposal(p_room_id, p_book jsonb, p_note)`: 활성 멤버. 참여자가 책 검색 결과에서 「제안하기」를 누르면 호출한다.
- RPC `list_room_book_proposals(p_room_id, p_status)`: 방장·운영자.
- RPC `resolve_room_book_proposal(p_proposal_id, p_decision text)`: 방장·운영자. 승인하면 기존 책 대화 생성 로직으로 책 대화를 만든다.
- 알림 종류 `book_proposal`(제안 → 방장·운영자), `book_proposal_resolved`(결과 → 제안자). 푸시 대기열도 연결한다.
- 웹·모바일: 책 검색 결과의 버튼을 역할에 따라 「추가하기」 또는 「제안하기」로 보여 주고, 「방 정보 > 요청」에서 승인·거절한다.

## 5단계 계약: 게시글 반응 (착수 시 상세 계획 작성)

- talk-103의 `20260802044000_add_post_reactions.sql`을 새 날짜로 옮긴다: `post_reactions(post_id, profile_id, emoji, created_at)`, 유니크 `(post_id, profile_id, emoji)`, RLS는 활성 방 멤버만 조회, RPC `toggle_post_reaction(p_post_id uuid, p_emoji text)`.
- 이모지는 허용 목록으로 제한한다(talk-103은 1~16자 자유 입력이었다). 목록은 착수 시 문안 검사와 함께 정한다.
- 웹·모바일 책 대화에 반응 칩과 길게 누르기(모바일) 또는 반응 버튼(웹)을 추가한다. 반응은 알림을 만들지 않는다.
- 참고 코드: talk-103 `BookDiscussionPage.tsx`의 반응 렌더링, `supabase/tests/database/070_posts.test.sql`, `090_post_rpcs.test.sql`의 반응 케이스.

## 범위 밖 (별도 결정 필요)

- talk-103의 답글·책갈피 경험 개선 커밋(`78b4a5b`, `e8dfaa1`, `2705a26`, `34b71bb`)은 이 계획에 넣지 않았다. 6단계 착수 전에 현재 main과 비교해 필요한 부분을 정한다.
- 모든 단계가 끝나면 PR #102를 닫고 `feat/talk-103-room-experience`, `refactor/talk-97-remove-reading-progress` 브랜치를 정리한다.
