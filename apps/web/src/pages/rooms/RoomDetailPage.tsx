import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'

import { bookChatKeys, getBookChats, getReadingRoom } from '../../entities/book-chat'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { AppHeader } from '../../shared/ui/AppHeader'
import { BookCover } from '../../shared/ui/BookCover'
import { LoadingSpinner } from '../../shared/ui/LoadingSpinner'
import { RetryState } from '../../shared/ui/RetryState'

/** 독서방 상세 페이지 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
export function RoomDetailPage() {
  const navigate = useNavigate()
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
          <button
            className="text-primary min-h-11 px-3 text-sm font-medium"
            onClick={() => void navigate(`/rooms/${roomId}/books/new`)}
            type="button"
          >
            새 책
          </button>
        }
        onBack={() => void navigate('/rooms')}
        title="독서방"
      />
      <header className="mt-8">
        <p className="text-primary text-sm font-medium">독서방</p>
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
  isError,
  isPending,
  isRetrying,
  onRetry,
  roomId,
}: {
  chats: Awaited<ReturnType<typeof getBookChats>> | undefined
  isError: boolean
  isPending: boolean
  isRetrying: boolean
  onRetry: () => void
  roomId: string
}) {
  const navigate = useNavigate()
  if (isPending)
    return (
      <div className="mt-6">
        <LoadingSpinner label="책을 불러오고 있어요." size="sm" />
      </div>
    )
  if (isRetrying)
    return (
      <div className="mt-6">
        <LoadingSpinner label="책을 다시 불러오고 있어요." size="sm" />
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
          <button
            className="border-ink/10 hover:border-primary flex min-h-24 w-full items-center gap-3 rounded-lg border bg-white p-4 text-left"
            onClick={() => void navigate(`/rooms/${roomId}/books/${chat.id}`)}
            type="button"
          >
            <BookCover alt={`${chat.title} 표지`} thumbnailUrl={chat.thumbnailUrl} />
            <span className="min-w-0">
              <span className="text-ink block text-sm font-bold">{chat.title}</span>
              <span className="text-ink-subtle mt-1 block text-xs">
                {chat.authors.join(', ') || chat.name}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

/** 빈 책 대화 목록 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
function EmptyBookChats() {
  return (
    <div className="bg-surface-muted mt-6 rounded-lg p-6 text-center">
      <p className="text-ink text-base font-medium">아직 함께 읽는 책이 없어요</p>
      <p className="text-ink-subtle mt-2 text-sm">첫 책을 골라 이야기를 시작해 보세요.</p>
    </div>
  )
}

/** 독서방 로딩 페이지 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
function RoomLoadingPage() {
  return (
    <main className="bg-surface flex min-h-screen items-center justify-center px-4">
      <LoadingSpinner label="독서방을 불러오고 있어요." />
    </main>
  )
}

/** 독서방 Unavailable 페이지 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
function RoomUnavailablePage({ onBack }: { onBack: () => void }) {
  return (
    <main className="bg-surface flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="text-ink text-lg font-medium">이 독서방을 찾을 수 없어요</p>
      <p className="text-ink-subtle mt-2 text-sm">참여 중인 독서방인지 확인해 주세요.</p>
      <button
        className="bg-primary mt-6 min-h-11 rounded-md px-4 text-sm font-semibold text-white"
        onClick={onBack}
        type="button"
      >
        내 독서방으로
      </button>
    </main>
  )
}
