import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ActionButton, Avatar, Icon } from '@seed-design/react'

import {
  formatRoomMemberSummary,
  formatRoomMessagePreview,
  formatRoomMessageTime,
  getReadingRooms,
  readingRoomKeys,
  type ReadingRoom,
  type ReadingRoomMember,
} from '../../entities/reading-room'
import {
  bookBestsellerKeys,
  getBookBestsellers,
  type BookBestseller,
  type BookBestsellerResult,
} from '../../entities/bestseller'
import { getUnreadNotificationCount, notificationKeys } from '../../entities/notification'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { BookCover } from '../../shared/ui/BookCover'
import { BookLoadingIndicator } from '../../shared/ui/LoadingSpinner'

/** 참여 중인 책방을 최근 대화 순서로 보여 주는 메인 화면을 렌더링한다. */
export function RoomsPage() {
  const roomsQuery = useQuery({
    queryFn: () => getReadingRooms(createSupabaseClient()),
    queryKey: readingRoomKeys.all,
  })
  const bestsellersQuery = useQuery({
    queryFn: () => getBookBestsellers(createSupabaseClient()),
    queryKey: bookBestsellerKeys.current,
    staleTime: 10 * 60 * 1000,
  })
  const isMainContentPending = roomsQuery.isPending || bestsellersQuery.isPending

  return (
    <main className="app-page bg-surface flex flex-col px-4">
      <header className="border-border -mx-4 flex min-h-16 items-center justify-between border-b px-4">
        <img alt="Talk후감" className="h-10 w-auto" src="/brand/talkhugam-wordmark-inverse.svg" />
        <NotificationInboxButton />
      </header>

      {isMainContentPending ? (
        <section
          aria-label="메인 콘텐츠 로딩"
          className="flex flex-1 items-center justify-center py-8"
        >
          <MainContentLoadingState />
        </section>
      ) : (
        <section aria-labelledby="recent-rooms-heading" className="flex flex-1 flex-col gap-6 py-8">
          <BestsellerSection result={bestsellersQuery.data} />
          <div className="flex flex-col gap-4">
            <h2 className="text-ink text-base font-bold" id="recent-rooms-heading">
              함께 읽는 책방
            </h2>
            <RoomsContent
              error={roomsQuery.error}
              isPending={roomsQuery.isPending}
              onRetry={() => void roomsQuery.refetch()}
              rooms={roomsQuery.data}
            />
          </div>
        </section>
      )}
    </main>
  )
}

/** 초기 책방과 베스트셀러 데이터를 함께 준비하는 동안 책 모양 로딩 상태를 렌더링한다. */
function MainContentLoadingState() {
  return <BookLoadingIndicator label="책방을 준비하고 있어요." size="sm" />
}

/** 알라딘 키가 설정됐을 때만 이번 주 베스트셀러 카드를 화면 상단에 렌더링한다. */
function BestsellerSection({ result }: { result: BookBestsellerResult | undefined }) {
  if (!result?.isConfigured || result.items.length === 0) return null

  return (
    <section aria-labelledby="bestseller-heading" className="flex flex-col gap-3">
      <div>
        <h2 className="text-ink text-base font-bold" id="bestseller-heading">
          이번 주 베스트셀러
        </h2>
        <p className="text-ink-subtle mt-1 text-xs">지금 많이 읽히는 책이에요.</p>
      </div>
      <BestsellerCarousel books={result.items} />
    </section>
  )
}

/** 현재 한 권과 이전·다음 추천 세 권을 수동으로 넘기는 베스트셀러 캐러셀을 렌더링한다. */
function BestsellerCarousel({ books }: { books: BookBestseller[] }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const previewBooks = getBestsellerPreviewBooks(books, activeIndex)

  if (books.length === 0) return null

  /** 현재 선택을 이전 베스트셀러로 한 칸 옮겨 카드 트랙을 부드럽게 이동한다. */
  function handlePreviousBook() {
    setActiveIndex((currentIndex) => Math.max(currentIndex - 1, 0))
  }

  /** 현재 선택을 다음 베스트셀러로 한 칸 옮겨 카드 트랙을 부드럽게 이동한다. */
  function handleNextBook() {
    setActiveIndex((currentIndex) => Math.min(currentIndex + 1, books.length - 1))
  }

  /** 미리보기에서 고른 책을 현재 크게 보여 줄 베스트셀러로 지정한다. */
  function handleSelectPreviewBook(bookIndex: number) {
    setActiveIndex(bookIndex)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-lg" role="region" aria-roledescription="carousel">
        <div
          className="flex transition-transform duration-500 ease-out motion-reduce:transition-none"
          data-testid="bestseller-track"
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
        >
          {books.map((book, index) => (
            <div aria-hidden={index !== activeIndex} className="w-full shrink-0" key={book.id}>
              <BestsellerFeature book={book} isActive={index === activeIndex} />
            </div>
          ))}
        </div>
      </div>
      {previewBooks.length > 0 ? (
        <ul aria-label="다른 추천 도서" className="grid grid-cols-3 gap-2">
          {previewBooks.map(({ book, index }) => (
            <li className="min-w-0" key={book.id}>
              <ActionButton
                aria-label={`${book.title} 추천 보기`}
                className="border-border hover:!border-ink !bg-surface-muted !flex !h-auto min-h-32 w-full !flex-col !items-start !justify-start gap-2 overflow-hidden rounded-md border p-2 text-left"
                onClick={() => handleSelectPreviewBook(index)}
                size="large"
                type="button"
                variant="neutralWeak"
              >
                <BookCover
                  alt={`${book.title} 표지`}
                  className="h-16 w-12"
                  thumbnailUrl={book.thumbnailUrl}
                />
                <span className="text-ink line-clamp-2 block w-full min-w-0 text-xs font-semibold !whitespace-normal">
                  {book.title}
                </span>
              </ActionButton>
            </li>
          ))}
        </ul>
      ) : null}
      {books.length > 1 ? (
        <div className="flex items-center justify-between">
          <ActionButton
            aria-label="이전 추천 보기"
            className="border-border text-ink hover:!border-ink disabled:text-ink/30 min-h-11 min-w-11 rounded-full border text-lg"
            disabled={activeIndex === 0}
            onClick={handlePreviousBook}
            size="medium"
            type="button"
            variant="neutralOutline"
          >
            ‹
          </ActionButton>
          <span aria-live="polite" className="text-ink-subtle text-xs">
            {activeIndex + 1} / {books.length}
          </span>
          <ActionButton
            aria-label="다음 추천 보기"
            className="border-border text-ink hover:!border-ink disabled:text-ink/30 min-h-11 min-w-11 rounded-full border text-lg"
            disabled={activeIndex === books.length - 1}
            onClick={handleNextBook}
            size="medium"
            type="button"
            variant="neutralOutline"
          >
            ›
          </ActionButton>
        </div>
      ) : null}
    </div>
  )
}

/** 현재 책을 제외하고 이전 한 권과 다음 두 권을 미리보기 순서로 반환한다. */
function getBestsellerPreviewBooks(books: BookBestseller[], activeIndex: number) {
  const previewOffsets = [-1, 1, 2]
  const selectedIndexes = new Set<number>()

  return previewOffsets.flatMap((offset) => {
    const index = (activeIndex + offset + books.length) % books.length
    const book = books[index]
    if (!book || selectedIndexes.has(index)) return []
    selectedIndexes.add(index)
    return [{ book, index }]
  })
}

/** 선택된 베스트셀러의 표지와 서지 정보를 카드로 렌더링하고 비활성 카드의 링크 초점을 막는다. */
function BestsellerFeature({ book, isActive }: { book: BookBestseller; isActive: boolean }) {
  const content = (
    <>
      <BookCover
        alt={`${book.title} 표지`}
        className="h-24 w-16 shrink-0"
        thumbnailUrl={book.thumbnailUrl}
      />
      <span className="min-w-0 flex-1">
        <h3 className="text-ink line-clamp-2 text-sm font-bold">{book.title}</h3>
        <span className="text-ink-subtle mt-1 line-clamp-2 block text-xs">
          {book.authors.join(', ') || book.publisher || '저자 정보 없음'}
        </span>
      </span>
    </>
  )

  const className =
    'border-border bg-surface hover:border-ink focus-visible:outline-primary flex min-h-32 items-center gap-3 rounded-lg border p-3 text-left'

  if (!book.externalUrl)
    return (
      <div className={className} data-testid="bestseller-feature">
        {content}
      </div>
    )

  return (
    <a
      aria-label={`${book.title} 자세히 보기`}
      className={className}
      data-testid="bestseller-feature"
      href={book.externalUrl}
      rel="noreferrer"
      tabIndex={isActive ? 0 : -1}
      target="_blank"
    >
      {content}
    </a>
  )
}

/** 읽지 않은 알림 수를 반영한 알림함 이동 버튼을 렌더링한다. */
function NotificationInboxButton() {
  const navigate = useNavigate()
  const unreadCountQuery = useQuery({
    queryFn: () => getUnreadNotificationCount(createSupabaseClient()),
    queryKey: notificationKeys.unreadCount,
  })
  const unreadCount = unreadCountQuery.data ?? 0

  return (
    <ActionButton
      aria-label={formatNotificationInboxLabel(unreadCount)}
      className="text-ink hover:!bg-surface-muted relative min-h-11 min-w-11 rounded-full"
      onClick={() => void navigate('/notifications')}
      size="medium"
      type="button"
      variant="ghost"
    >
      <NotificationBellIcon />
      {unreadCount > 0 ? (
        <span
          aria-hidden="true"
          className="bg-primary absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full px-1 text-xs font-bold text-white"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      ) : null}
    </ActionButton>
  )
}

/** 읽지 않은 알림 개수를 스크린 리더가 이해할 수 있는 버튼 이름으로 변환한다. */
function formatNotificationInboxLabel(unreadCount: number): string {
  if (unreadCount === 0) return '알림함'
  return `알림함, 읽지 않은 알림 ${unreadCount}개`
}

/** 알림함으로 이동하는 버튼에 사용할 종 모양 아이콘을 렌더링한다. */
function NotificationBellIcon() {
  return (
    <Icon
      size="20px"
      svg={
        <svg fill="none" viewBox="0 0 24 24">
          <path
            d="M18 10a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      }
    />
  )
}

/** 책방 목록의 조회 결과에 맞는 콘텐츠 상태를 렌더링한다. */
function RoomsContent({
  error,
  isPending,
  onRetry,
  rooms,
}: {
  error: Error | null
  isPending: boolean
  onRetry: () => void
  rooms: ReadingRoom[] | undefined
}) {
  if (isPending) return <RoomsLoadingState />

  if (error) return <RoomsErrorState onRetry={onRetry} />

  if (!rooms || rooms.length === 0) return <EmptyRoomsState />

  return <RoomsList rooms={rooms} />
}

/** 책방 목록을 불러오는 동안 브랜드 로딩 상태를 렌더링한다. */
function RoomsLoadingState() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <BookLoadingIndicator label="책방을 불러오고 있어요." />
    </div>
  )
}

/** 책방 목록을 불러오지 못했을 때 재시도 안내를 렌더링한다. */
function RoomsErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <p className="text-ink text-lg font-medium">책방을 불러오지 못했어요</p>
      <p className="text-ink-subtle mt-2 text-sm">잠시 후 다시 시도해 주세요.</p>
      <ActionButton
        className="talkhugam-primary-action mt-6"
        onClick={onRetry}
        size="large"
        type="button"
        variant="brandSolid"
      >
        다시 시도하기
      </ActionButton>
    </div>
  )
}

/** 아직 참여한 책방이 없을 때 시작 방법을 안내한다. */
function EmptyRoomsState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <p className="text-ink text-lg font-medium">아직 참여한 책방이 없어요</p>
      <p className="text-ink-subtle mt-2 text-sm">책방을 만들거나 초대 코드로 참여해 보세요.</p>
      <p className="text-ink-subtle mt-12 text-xs">새 책방은 하단 + 버튼에서 만들 수 있어요.</p>
    </div>
  )
}

/** 최근 대화가 있는 순서로 책방 카드를 렌더링한다. */
function RoomsList({ rooms }: { rooms: ReadingRoom[] }) {
  const navigate = useNavigate()

  return (
    <ul className="space-y-3">
      {rooms.map((room) => (
        <li className="border-border rounded-lg border bg-white" key={room.id}>
          <ActionButton
            className="!grid !h-auto min-h-24 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-4 text-left !whitespace-normal"
            onClick={() => void navigate(`/rooms/${room.id}`)}
            size="large"
            type="button"
            variant="ghost"
          >
            <RoomMemberAvatars members={room.members} />
            <span className="min-w-0">
              <span className="text-ink block truncate text-base font-semibold">{room.name}</span>
              <span className="text-ink-subtle mt-2 block truncate text-sm">
                {formatRoomMessagePreview(room)}
              </span>
              <span className="text-ink-subtle mt-1 block truncate text-xs">
                {formatRoomMemberSummary(room.members)}
              </span>
            </span>
            <span className="text-ink-subtle flex shrink-0 items-center gap-2 text-sm">
              {formatRoomMessageTime(room.lastMessage?.createdAt ?? null) ?? '새 책방'}
              <Icon
                size="20px"
                svg={
                  <svg fill="none" viewBox="0 0 24 24">
                    <path
                      d="m9 18 6-6-6-6"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                  </svg>
                }
              />
            </span>
          </ActionButton>
        </li>
      ))}
    </ul>
  )
}

/** 책방 멤버 프로필 이미지 목록 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
function RoomMemberAvatars({ members }: { members: readonly ReadingRoomMember[] }) {
  const visibleMembers = members.slice(0, 3)
  const remainingCount = members.length - visibleMembers.length

  return (
    <Avatar.Stack aria-hidden="true" size="36">
      {visibleMembers.map((member) => (
        <Avatar.Root key={member.joinedAt} size="36">
          <Avatar.Fallback className="bg-surface-muted text-ink-subtle text-xs font-semibold">
            {member.displayName.slice(0, 1)}
          </Avatar.Fallback>
        </Avatar.Root>
      ))}
      {remainingCount > 0 ? (
        <Avatar.Root size="36">
          <Avatar.Fallback className="bg-ink text-surface text-xs font-semibold">
            +{remainingCount}
          </Avatar.Fallback>
        </Avatar.Root>
      ) : null}
    </Avatar.Stack>
  )
}
