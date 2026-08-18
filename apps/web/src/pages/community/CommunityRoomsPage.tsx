import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ActionButton } from '@seed-design/react'
import { useNavigate } from 'react-router-dom'

import { communityKeys, getCommunityRooms, type CommunityRoom } from '../../entities/community'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { AppHeader } from '../../shared/ui/AppHeader'
import { BookLoadingIndicator } from '../../shared/ui/LoadingSpinner'
import { RetryState } from '../../shared/ui/RetryState'

/** 모든 로그인 사용자가 참여할 수 있는 오픈 책방 발견 화면을 렌더링한다. */
export function CommunityRoomsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const roomsQuery = useQuery({
    queryFn: () => getCommunityRooms(createSupabaseClient()),
    queryKey: communityKeys.discovery(),
  })

  /** 오픈 책방 목록을 서버에서 다시 조회한다. */
  function handleRetry() {
    void queryClient.invalidateQueries({ queryKey: communityKeys.discovery() })
  }

  return (
    <main className="app-page bg-surface px-4 pb-8">
      <AppHeader
        action={
          <ActionButton
            className="text-primary min-h-11"
            onClick={() => void navigate('/community/create')}
            size="small"
            type="button"
            variant="ghost"
          >
            새 오픈 책방
          </ActionButton>
        }
        onBack={() => void navigate('/rooms')}
        title="오픈 책방"
      />
      <header className="mt-8">
        <h1 className="text-ink text-xl font-bold">같이 읽을 사람을 찾아요</h1>
        <p className="text-ink-subtle mt-2 text-sm">팔로우한 사람이 만든 책방을 먼저 보여드려요.</p>
      </header>
      {roomsQuery.isPending ? (
        <div className="mt-12">
          <BookLoadingIndicator label="오픈 책방을 불러오고 있어요." />
        </div>
      ) : null}
      {roomsQuery.isError ? (
        <div className="mt-12">
          <RetryState message="오픈 책방을 불러오지 못했어요." onRetry={handleRetry} />
        </div>
      ) : null}
      {roomsQuery.data ? <CommunityRoomList rooms={roomsQuery.data} /> : null}
    </main>
  )
}

/** 발견한 오픈 책방을 정원·입장 방식과 함께 카드 목록으로 렌더링한다. */
function CommunityRoomList({ rooms }: { rooms: CommunityRoom[] }) {
  const navigate = useNavigate()
  if (rooms.length === 0)
    return (
      <p className="text-ink-subtle mt-12 text-center text-sm">
        아직 열린 책방이 없어요. 첫 책방을 열어 보세요.
      </p>
    )

  return (
    <ul className="mt-8 space-y-3">
      {rooms.map((room) => (
        <li className="border-border rounded-lg border" key={room.id}>
          <ActionButton
            className="!h-auto min-h-28 w-full !items-start !justify-start p-4 text-left !whitespace-normal"
            onClick={() =>
              void navigate(`/community/${room.id}/join?password=${room.access === 'password'}`)
            }
            size="large"
            type="button"
            variant="ghost"
          >
            <span className="min-w-0">
              {room.isFollowingCreator ? (
                <span className="text-primary block text-xs font-semibold">
                  팔로우한 사람이 열었어요
                </span>
              ) : null}
              <span className="text-ink mt-1 block text-base font-bold">{room.name}</span>
              {room.description ? (
                <span className="text-ink-subtle mt-2 block text-sm">{room.description}</span>
              ) : null}
              <span className="text-ink-subtle mt-3 block text-xs">
                {room.access === 'password' ? '비밀번호 필요' : '바로 참여'} ·{' '}
                {room.activeMemberCount} / {room.capacity}명
              </span>
            </span>
          </ActionButton>
        </li>
      ))}
    </ul>
  )
}
