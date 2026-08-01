import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { ActionButton } from '@seed-design/react'

import { bookChatKeys, getBookChats, getReadingRoom } from '../../entities/book-chat'
import { bookCompletionKeys, getMyBookChatCompletionIds } from '../../entities/book-completion'
import {
  getMyReadingProgresses,
  readingProgressKeys,
  type ReadingProgress,
} from '../../entities/reading-progress'
import { useAuthenticatedUser } from '../../features/auth'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { AppHeader } from '../../shared/ui/AppHeader'
import { BookCover } from '../../shared/ui/BookCover'
import { BookLoadingIndicator } from '../../shared/ui/LoadingSpinner'
import { RetryState } from '../../shared/ui/RetryState'
import { ReadingStatus } from '../../shared/ui/ReadingStatus'

/** 선택한 책방의 책 대화와 관리 진입점을 렌더링한다. */
export function RoomDetailPage() {
  const navigate = useNavigate()
  const profileId = useAuthenticatedUser().id
  const { roomId } = useParams()
  const roomQuery = useQuery({
    enabled: Boolean(roomId),
    queryFn: () => getReadingRoom(createSupabaseClient(), roomId ?? ''),
    queryKey: bookChatKeys.room(roomId ?? ''),
  })
  const chatsQuery = useQuery({
    enabled: Boolean(roomId) && Boolean(roomQuery.data),
    queryFn: () => getBookChats(createSupabaseClient(), roomId ?? ''),
    queryKey: bookChatKeys.byRoom(roomId ?? ''),
  })
  const completionIdsQuery = useQuery({
    queryFn: () => getMyBookChatCompletionIds(createSupabaseClient(), profileId),
    queryKey: bookCompletionKeys.myBookChatIds(profileId),
  })
  const progressesQuery = useQuery({
    queryFn: () => getMyReadingProgresses(createSupabaseClient(), profileId),
    queryKey: readingProgressKeys.byProfile(profileId),
  })

  if (!roomId)
    return <RoomUnavailablePage onBack={() => void navigate('/rooms', { replace: true })} />
  if (roomQuery.isPending) return <RoomLoadingPage />
  if (roomQuery.isError || !roomQuery.data)
    return <RoomUnavailablePage onBack={() => void navigate('/rooms', { replace: true })} />

  /** 책 대화 목록 조회를 다시 요청한다. */
  function handleRetryBookChats() {
    void chatsQuery.refetch()
  }

  return (
    <main className="app-page bg-surface px-4 pb-8">
      <AppHeader
        action={
          <ActionButton
            aria-label="방 정보와 멤버 관리"
            className="text-ink min-h-11 min-w-11 px-3 text-xl"
            onClick={() => void navigate(`/rooms/${roomId}/manage`)}
            size="small"
            type="button"
            variant="ghost"
          >
            ⋯
          </ActionButton>
        }
        onBack={() => void navigate('/rooms')}
        title="책방"
      />
      <header className="mt-8">
        <p className="text-primary text-sm font-medium">책방</p>
        <h1 className="text-ink mt-2 text-xl font-bold">{roomQuery.data.name}</h1>
        {roomQuery.data.description ? (
          <p className="text-ink-subtle mt-2 text-sm">{roomQuery.data.description}</p>
        ) : null}
      </header>

      <section className="mt-12" aria-labelledby="reading-books-heading">
        <h2 className="text-ink text-base font-bold" id="reading-books-heading">
          지금 함께 읽는 책
        </h2>
        <BookChatsContent
          isPending={chatsQuery.isPending}
          isError={chatsQuery.isError}
          isRetrying={chatsQuery.isFetching}
          chats={chatsQuery.data}
          completedBookChatIds={new Set(completionIdsQuery.data ?? [])}
          progressesByBookChatId={createProgressesByBookChatId(progressesQuery.data ?? [])}
          onRetry={handleRetryBookChats}
          roomId={roomId}
        />
      </section>
    </main>
  )
}

/** 책 대화 목록 콘텐츠 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
function BookChatsContent({
  chats,
  completedBookChatIds,
  isError,
  isPending,
  isRetrying,
  onRetry,
  progressesByBookChatId,
  roomId,
}: {
  chats: Awaited<ReturnType<typeof getBookChats>> | undefined
  completedBookChatIds: ReadonlySet<string>
  isError: boolean
  isPending: boolean
  isRetrying: boolean
  onRetry: () => void
  progressesByBookChatId: ReadonlyMap<string, ReadingProgress>
  roomId: string
}) {
  const navigate = useNavigate()
  if (isPending)
    return (
      <div className="mt-6">
        <BookLoadingIndicator label="책을 불러오고 있어요." size="sm" />
      </div>
    )
  if (isRetrying)
    return (
      <div className="mt-6">
        <BookLoadingIndicator label="책을 다시 불러오고 있어요." size="sm" />
      </div>
    )
  if (isError)
    return (
      <div className="mt-6">
        <RetryState message="책 목록을 불러오지 못했어요." onRetry={onRetry} />
      </div>
    )
  if (!chats || chats.length === 0) return <EmptyBookChats />

  return (
    <ul className="mt-4 space-y-3">
      {chats.map((chat) => (
        <li key={chat.id}>
          <ActionButton
            className="border-ink/10 hover:!border-primary !h-auto min-h-24 w-full !justify-start gap-3 rounded-lg border !bg-white p-4 text-left !whitespace-normal"
            onClick={() => void navigate(`/rooms/${roomId}/books/${chat.id}`)}
            size="large"
            type="button"
            variant="neutralWeak"
          >
            <BookCover alt={`${chat.title} 표지`} thumbnailUrl={chat.thumbnailUrl} />
            <span className="min-w-0">
              <span className="text-ink block text-sm font-bold">{chat.title}</span>
              <span className="text-ink-subtle mt-1 block text-xs">
                {chat.authors.join(', ') || chat.name}
              </span>
              <ReadingStatus
                currentPage={progressesByBookChatId.get(chat.id)?.currentPage}
                isCompleted={completedBookChatIds.has(chat.id)}
                totalPages={progressesByBookChatId.get(chat.id)?.totalPages}
              />
            </span>
          </ActionButton>
        </li>
      ))}
    </ul>
  )
}

/** 개인 독서 진행률 배열을 책 대화 식별자로 빠르게 조회할 수 있는 Map으로 변환한다. */
function createProgressesByBookChatId(
  progresses: ReadingProgress[],
): ReadonlyMap<string, ReadingProgress> {
  return new Map(progresses.map((progress) => [progress.bookChatId, progress]))
}

/** 빈 책 대화 목록 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
function EmptyBookChats() {
  return (
    <div className="talkhugam-information-surface border-ink/10 mt-6 rounded-lg border p-6 text-center">
      <p className="text-ink text-base font-medium">아직 함께 읽는 책이 없어요</p>
      <p className="text-ink-subtle mt-2 text-sm">
        이 책방에는 여러 권의 책을 차례로 함께 읽을 수 있어요. 방장에게 첫 책을 제안해 보세요.
      </p>
    </div>
  )
}

/** 책방을 불러오는 동안 브랜드 로딩 상태를 렌더링한다. */
function RoomLoadingPage() {
  return (
    <main className="bg-surface flex min-h-screen items-center justify-center px-4">
      <BookLoadingIndicator label="책방을 불러오고 있어요." />
    </main>
  )
}

/** 접근할 수 없는 책방의 안내를 렌더링한다. */
function RoomUnavailablePage({ onBack }: { onBack: () => void }) {
  return (
    <main className="bg-surface flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="text-ink text-lg font-medium">이 책방을 찾을 수 없어요</p>
      <p className="text-ink-subtle mt-2 text-sm">참여 중인 책방인지 확인해 주세요.</p>
      <ActionButton
        className="talkhugam-primary-action mt-6"
        onClick={onBack}
        size="large"
        type="button"
        variant="brandSolid"
      >
        내 책방으로
      </ActionButton>
    </main>
  )
}
