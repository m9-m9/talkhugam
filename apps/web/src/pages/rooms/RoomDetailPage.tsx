import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { bookChatKeys, getBookChats, getReadingRoom } from '../../entities/book-chat'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { LoadingSpinner } from '../../shared/ui/LoadingSpinner'

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

  useEffect(() => {
    async function protectRoute() {
      const response = await createSupabaseClient().auth.getUser()
      if (response.error || !response.data.user) void navigate('/', { replace: true })
    }

    void protectRoute()
  }, [navigate])

  if (!roomId)
    return <RoomUnavailablePage onBack={() => void navigate('/rooms', { replace: true })} />
  if (roomQuery.isPending) return <RoomLoadingPage />
  if (roomQuery.isError || !roomQuery.data)
    return <RoomUnavailablePage onBack={() => void navigate('/rooms', { replace: true })} />

  return (
    <main className="app-page bg-surface px-6 py-8">
      <button
        className="text-ink-subtle -ml-3 min-h-11 px-3 text-sm"
        onClick={() => void navigate('/rooms')}
        type="button"
      >
        ← 내 독서방
      </button>
      <header className="mt-3">
        <p className="text-primary text-sm font-medium">독서방</p>
        <h1 className="text-ink mt-2 text-xl font-bold">{roomQuery.data.name}</h1>
        {roomQuery.data.description ? (
          <p className="text-ink-subtle mt-2 text-sm">{roomQuery.data.description}</p>
        ) : null}
      </header>

      <section className="mt-12" aria-labelledby="reading-books-heading">
        <div className="flex items-center justify-between">
          <h2 className="text-ink text-base font-bold" id="reading-books-heading">
            지금 함께 읽는 책
          </h2>
          <button
            className="text-primary min-h-11 px-3 text-sm font-medium"
            onClick={() => void navigate(`/rooms/${roomId}/books/new`)}
            type="button"
          >
            새 책
          </button>
        </div>
        <BookChatsContent
          isPending={chatsQuery.isPending}
          isError={chatsQuery.isError}
          chats={chatsQuery.data}
          roomId={roomId}
        />
      </section>
    </main>
  )
}

function BookChatsContent({
  chats,
  isError,
  isPending,
  roomId,
}: {
  chats: Awaited<ReturnType<typeof getBookChats>> | undefined
  isError: boolean
  isPending: boolean
  roomId: string
}) {
  const navigate = useNavigate()
  if (isPending)
    return (
      <div className="mt-6">
        <LoadingSpinner label="책을 불러오고 있어요." size="sm" />
      </div>
    )
  if (isError)
    return (
      <p className="mt-6 text-sm text-red-600" role="alert">
        책 목록을 불러오지 못했어요.
      </p>
    )
  if (!chats || chats.length === 0) return <EmptyBookChats />

  return (
    <ul className="mt-4 space-y-3">
      {chats.map((chat) => (
        <li key={chat.id}>
          <button
            className="border-ink/10 hover:border-primary min-h-16 w-full rounded-lg border bg-white p-4 text-left"
            onClick={() => void navigate(`/rooms/${roomId}/books/${chat.id}`)}
            type="button"
          >
            <p className="text-ink text-sm font-bold">{chat.title}</p>
            <p className="text-ink-subtle mt-1 text-xs">{chat.authors.join(', ') || chat.name}</p>
          </button>
        </li>
      ))}
    </ul>
  )
}

function EmptyBookChats() {
  return (
    <div className="bg-surface-muted mt-6 rounded-lg p-6 text-center">
      <p className="text-ink text-base font-medium">아직 함께 읽는 책이 없어요</p>
      <p className="text-ink-subtle mt-2 text-sm">첫 책을 골라 이야기를 시작해 보세요.</p>
    </div>
  )
}

function RoomLoadingPage() {
  return (
    <main className="bg-surface flex min-h-screen items-center justify-center px-6">
      <LoadingSpinner label="독서방을 불러오고 있어요." />
    </main>
  )
}

function RoomUnavailablePage({ onBack }: { onBack: () => void }) {
  return (
    <main className="bg-surface flex min-h-screen flex-col items-center justify-center px-6 text-center">
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
