import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import {
  formatRoomMemberSummary,
  formatRoomMessagePreview,
  formatRoomMessageTime,
  getReadingRooms,
  readingRoomKeys,
  type ReadingRoom,
  type ReadingRoomMember,
} from '../../entities/reading-room'
import { getUnreadNotificationCount, notificationKeys } from '../../entities/notification'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { LoadingSpinner } from '../../shared/ui/LoadingSpinner'

/** 독서방 목록 페이지 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
export function RoomsPage() {
  const roomsQuery = useQuery({
    queryFn: () => getReadingRooms(createSupabaseClient()),
    queryKey: readingRoomKeys.all,
  })

  return (
    <main className="app-page bg-surface flex flex-col px-4">
      <header className="border-ink/10 -mx-4 flex min-h-16 items-center justify-between border-b px-4">
        <img alt="Talk후감" className="h-10 w-auto" src="/brand/talkhugam-wordmark.svg" />
        <NotificationInboxButton />
      </header>

      <section aria-labelledby="recent-rooms-heading" className="flex flex-1 flex-col py-8">
        <RoomsContent
          error={roomsQuery.error}
          isPending={roomsQuery.isPending}
          onRetry={() => void roomsQuery.refetch()}
          rooms={roomsQuery.data}
        />
      </section>
    </main>
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
    <button
      aria-label={formatNotificationInboxLabel(unreadCount)}
      className="text-ink hover:bg-surface-muted focus-visible:ring-primary relative flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full focus-visible:ring-2 focus-visible:outline-none"
      onClick={() => void navigate('/notifications')}
      type="button"
    >
      <NotificationBellIcon />
      {unreadCount > 0 ? (
        <span
          aria-hidden="true"
          className="bg-primary text-ink absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full px-1 text-xs font-bold"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      ) : null}
    </button>
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
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M18 10a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

/** 독서방 목록 콘텐츠 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
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

/** 독서방 목록 로딩 상태 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
function RoomsLoadingState() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <LoadingSpinner label="독서방을 불러오고 있어요." />
    </div>
  )
}

/** 독서방 목록 오류 상태 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
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

/** 빈 독서방 목록 상태 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
function EmptyRoomsState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <p className="text-ink text-lg font-medium">아직 참여한 독서방이 없어요</p>
      <p className="text-ink-subtle mt-2 text-sm">독서방을 만들거나 초대 코드로 참여해 보세요.</p>
      <p className="text-ink-subtle mt-12 text-xs">새 독서방은 하단 + 버튼에서 만들 수 있어요.</p>
    </div>
  )
}

/** 독서방 목록 목록 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
function RoomsList({ rooms }: { rooms: ReadingRoom[] }) {
  const navigate = useNavigate()

  return (
    <div>
      <h2 className="text-ink text-base font-bold" id="recent-rooms-heading">
        함께 읽는 모임
      </h2>
      <ul className="mt-4 space-y-3">
        {rooms.map((room) => (
          <li key={room.id}>
            <button
              className="border-ink/10 hover:border-primary focus-visible:outline-primary min-h-24 w-full rounded-lg border bg-white p-4 text-left"
              onClick={() => void navigate(`/rooms/${room.id}`)}
              type="button"
            >
              <span className="flex items-start gap-3">
                <RoomMemberAvatars members={room.members} />
                <span className="min-w-0 flex-1">
                  <span className="text-ink block text-sm font-bold">{room.name}</span>
                  <span className="text-ink-subtle mt-1 block truncate text-xs">
                    {formatRoomMessagePreview(room)}
                  </span>
                  <span className="text-ink-subtle mt-3 block text-xs">
                    {formatRoomMemberSummary(room.members)}
                  </span>
                </span>
                <span className="text-ink-subtle flex flex-col items-end gap-2 pt-1 text-xs">
                  {formatRoomMessageTime(room.lastMessage?.createdAt ?? null) ?? '새 모임'}
                  <span aria-hidden="true" className="text-lg">
                    ›
                  </span>
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** 독서방 멤버 프로필 이미지 목록 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
function RoomMemberAvatars({ members }: { members: readonly ReadingRoomMember[] }) {
  const visibleMembers = members.slice(0, 3)
  const remainingCount = members.length - visibleMembers.length

  return (
    <span aria-hidden="true" className="flex shrink-0 -space-x-2 pt-1">
      {visibleMembers.map((member) => (
        <span
          className="border-surface bg-surface-muted text-ink-subtle flex size-8 items-center justify-center rounded-full border-2 text-xs font-semibold"
          key={member.joinedAt}
        >
          {member.displayName.slice(0, 1)}
        </span>
      ))}
      {remainingCount > 0 ? (
        <span className="border-surface bg-primary text-ink flex size-8 items-center justify-center rounded-full border-2 text-xs font-semibold">
          +{remainingCount}
        </span>
      ) : null}
    </span>
  )
}
