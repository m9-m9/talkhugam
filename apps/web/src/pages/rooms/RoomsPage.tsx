import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { getReadingRooms, readingRoomKeys, type ReadingRoom } from '../../entities/reading-room'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { LoadingSpinner } from '../../shared/ui/LoadingSpinner'

export function RoomsPage() {
  const navigate = useNavigate()
  const [isAuthenticating, setIsAuthenticating] = useState(true)
  const roomsQuery = useQuery({
    enabled: !isAuthenticating,
    queryFn: () => getReadingRooms(createSupabaseClient()),
    queryKey: readingRoomKeys.all,
  })

  useEffect(() => {
    async function protectRoute() {
      const response = await createSupabaseClient().auth.getUser()
      if (response.error || !response.data.user) {
        void navigate('/', { replace: true })
        return
      }

      setIsAuthenticating(false)
    }

    void protectRoute()
  }, [navigate])

  if (isAuthenticating)
    return (
      <main className="bg-surface flex min-h-screen items-center justify-center px-6">
        <LoadingSpinner label="로그인 정보를 확인하고 있어요." />
      </main>
    )

  return (
    <main className="bg-surface mx-auto flex min-h-screen w-full max-w-md flex-col">
      <header className="flex items-center justify-between px-6 pt-6 pb-4">
        <h1 className="text-ink text-lg font-bold">내 독서방</h1>
        <button
          aria-label="초대 코드로 독서방 참여하기"
          className="text-primary min-h-11 px-3 text-sm font-medium"
          onClick={() => void navigate('/rooms/join')}
          type="button"
        >
          초대
        </button>
      </header>

      <nav aria-label="하위 메뉴" className="border-ink/10 flex border-b px-6">
        <button
          aria-current="page"
          className="text-primary border-primary min-h-11 px-3 text-sm font-medium"
          type="button"
        >
          독서방
        </button>
        <button
          className="text-ink-subtle ml-auto min-h-11 px-3 text-sm"
          onClick={() => void navigate('/profile')}
          type="button"
        >
          내 정보
        </button>
      </nav>

      <section aria-labelledby="recent-rooms-heading" className="flex flex-1 flex-col px-6 py-8">
        <RoomsContent
          error={roomsQuery.error}
          isPending={roomsQuery.isPending}
          onRetry={() => void roomsQuery.refetch()}
          rooms={roomsQuery.data}
        />
      </section>

      <button
        aria-label="새 독서방 만들기"
        className="bg-primary fixed right-6 bottom-6 flex size-12 items-center justify-center rounded-full text-3xl font-light text-white shadow-lg"
        onClick={() => void navigate('/rooms/create')}
        type="button"
      >
        <span aria-hidden="true">+</span>
      </button>
    </main>
  )
}

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

function RoomsLoadingState() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <LoadingSpinner label="독서방을 불러오고 있어요." />
    </div>
  )
}

function RoomsErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <p className="text-ink text-lg font-medium">독서방을 불러오지 못했어요</p>
      <p className="text-ink-subtle mt-2 text-sm">잠시 후 다시 시도해 주세요.</p>
      <button
        className="bg-primary mt-6 min-h-11 rounded-md px-4 text-sm font-semibold text-white"
        onClick={onRetry}
        type="button"
      >
        다시 시도하기
      </button>
    </div>
  )
}

function EmptyRoomsState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <p className="text-ink text-lg font-medium">아직 참여한 독서방이 없어요</p>
      <p className="text-ink-subtle mt-2 text-sm">독서방을 만들거나 초대 코드로 참여해 보세요.</p>
      <p className="text-ink-subtle mt-12 text-xs">새 독서방은 하단 + 버튼에서 만들 수 있어요.</p>
    </div>
  )
}

function RoomsList({ rooms }: { rooms: ReadingRoom[] }) {
  const navigate = useNavigate()

  return (
    <div>
      <h2 className="text-ink text-base font-bold" id="recent-rooms-heading">
        최근 대화
      </h2>
      <ul className="mt-4 space-y-3">
        {rooms.map((room) => (
          <li key={room.id}>
            <button
              className="border-ink/10 hover:border-primary focus-visible:outline-primary min-h-16 w-full rounded-lg border bg-white p-4 text-left"
              onClick={() => void navigate(`/rooms/${room.id}`)}
              type="button"
            >
              <span className="text-ink block text-sm font-bold">{room.name}</span>
              <span className="text-ink-subtle mt-1 block text-xs">
                {room.description ?? '아직 새 감상이 없어요'}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
