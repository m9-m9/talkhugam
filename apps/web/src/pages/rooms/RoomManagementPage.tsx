import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import {
  createManagedRoomInvite,
  getRoomManagement,
  leaveManagedRoom,
  removeManagedRoomMember,
  roomManagementKeys,
  transferManagedRoomOwnership,
  type RoomManagementMember,
} from '../../entities/room-management'
import { readingRoomKeys } from '../../entities/reading-room'
import { useAuthenticatedUser } from '../../features/auth'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { AppHeader } from '../../shared/ui/AppHeader'
import { LoadingSpinner } from '../../shared/ui/LoadingSpinner'

type PendingAction =
  | { member: RoomManagementMember; type: 'remove' | 'transfer' }
  | { type: 'archive' | 'leave' }
  | null

/** 방장과 멤버가 방 정보, 초대, 멤버 구성을 관리하는 화면을 렌더링한다. */
export function RoomManagementPage() {
  const client = createSupabaseClient()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthenticatedUser()
  const { roomId } = useParams()
  const [createdInviteCode, setCreatedInviteCode] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const roomQuery = useQuery({
    enabled: Boolean(roomId),
    queryFn: () => getRoomManagement(client, roomId ?? '', user.id),
    queryKey: roomManagementKeys.detail(roomId ?? ''),
  })
  const inviteMutation = useMutation({
    mutationFn: () => createManagedRoomInvite(client, roomId ?? ''),
    onSuccess: (invite) => setCreatedInviteCode(invite.code),
  })
  const memberMutation = useMutation({
    mutationFn: async (action: Exclude<PendingAction, null>) => {
      if (action.type === 'remove')
        return removeManagedRoomMember(client, roomId ?? '', action.member.id)
      if (action.type === 'transfer')
        return transferManagedRoomOwnership(client, roomId ?? '', action.member.id)
      return leaveManagedRoom(client, roomId ?? '', action.type === 'archive' ? 'archive' : null)
    },
    onSuccess: async (_, action) => {
      setPendingAction(null)
      if (action.type === 'archive' || action.type === 'leave') {
        await queryClient.invalidateQueries({ queryKey: readingRoomKeys.all })
        void navigate('/rooms', { replace: true })
        return
      }
      await queryClient.invalidateQueries({ queryKey: roomManagementKeys.detail(roomId ?? '') })
    },
  })

  /** 초대 코드를 클립보드에 복사한다. */
  async function handleCopyInvite() {
    if (createdInviteCode === null) return
    await navigator.clipboard.writeText(createdInviteCode)
  }

  /** 확인된 관리 동작을 서버에 요청한다. */
  function handleConfirmAction() {
    if (pendingAction === null) return
    memberMutation.mutate(pendingAction)
  }

  if (!roomId) return <RoomManagementUnavailablePage onBack={() => void navigate('/rooms')} />
  if (roomQuery.isPending) return <RoomManagementLoadingPage />
  if (roomQuery.isError || roomQuery.data === null)
    return <RoomManagementUnavailablePage onBack={() => void navigate('/rooms')} />

  const room = roomQuery.data
  return (
    <main className="app-page bg-surface px-4 pb-8">
      <AppHeader onBack={() => void navigate(`/rooms/${roomId}`)} title="방 정보" />
      <header className="mt-8">
        <p className="text-primary text-sm font-medium">함께 읽는 책방</p>
        <h1 className="text-ink mt-2 text-xl font-bold">{room.name}</h1>
        <p className="text-ink-subtle mt-2 text-sm">{room.description ?? '아직 소개가 없어요.'}</p>
      </header>

      {room.isCurrentUserOwner ? (
        <section className="mt-8" aria-labelledby="room-management-actions">
          <h2 className="text-ink text-base font-bold" id="room-management-actions">
            방 관리
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              className="border-primary text-primary min-h-12 rounded-md border bg-white px-4 text-sm font-semibold"
              onClick={() => inviteMutation.mutate()}
              type="button"
            >
              초대 코드 만들기
            </button>
            <button
              className="border-ink/10 text-ink min-h-12 rounded-md border bg-white px-4 text-sm font-semibold"
              onClick={() => void navigate(`/rooms/${roomId}/manage/settings`)}
              type="button"
            >
              방 설정
            </button>
          </div>
          {inviteMutation.isPending ? (
            <div className="mt-4">
              <LoadingSpinner label="초대 코드를 만들고 있어요." size="xs" />
            </div>
          ) : null}
          {inviteMutation.isError ? (
            <p className="mt-3 text-sm text-red-600" role="alert">
              초대 코드를 만들지 못했어요. 다시 시도해 주세요.
            </p>
          ) : null}
          {createdInviteCode ? (
            <div className="bg-surface-muted mt-4 rounded-lg p-4">
              <p className="text-ink-subtle text-xs">지금 한 번만 확인할 수 있는 초대 코드예요.</p>
              <p className="text-ink mt-2 text-2xl font-bold tracking-[0.2em]">
                {createdInviteCode}
              </p>
              <button
                className="text-primary mt-3 min-h-11 text-sm font-semibold"
                onClick={() => void handleCopyInvite()}
                type="button"
              >
                코드 복사하기
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="mt-12" aria-labelledby="room-members-heading">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-ink text-base font-bold" id="room-members-heading">
            함께하는 사람 {room.members.length}명
          </h2>
          {room.isCurrentUserOwner ? (
            <span className="text-ink-subtle text-xs">방장만 관리할 수 있어요</span>
          ) : null}
        </div>
        <ul className="border-ink/10 mt-4 overflow-hidden rounded-lg border bg-white">
          {room.members.map((member) => (
            <li
              className="border-ink/10 flex min-h-16 items-center gap-3 border-b p-4 last:border-b-0"
              key={member.id}
            >
              <span
                aria-hidden="true"
                className="bg-surface-muted text-primary flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
              >
                {member.displayName.slice(0, 1)}
              </span>
              <MemberProfileLink member={member} roomId={roomId} />
              {room.isCurrentUserOwner && !member.isCurrentUser ? (
                <MemberMenu
                  member={member}
                  onRemove={() => setPendingAction({ member, type: 'remove' })}
                  onTransfer={() => setPendingAction({ member, type: 'transfer' })}
                />
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="room-exit-heading">
        <h2 className="text-ink text-base font-bold" id="room-exit-heading">
          나가기
        </h2>
        <p className="text-ink-subtle mt-2 text-sm">
          대화는 방에 남고, 다시 참여하려면 초대 코드가 필요해요.
        </p>
        <button
          className="border-ink/10 text-ink mt-4 min-h-11 w-full rounded-md border bg-white px-4 text-sm font-semibold"
          onClick={() =>
            setPendingAction({
              type: room.isCurrentUserOwner && room.members.length === 1 ? 'archive' : 'leave',
            })
          }
          type="button"
        >
          {room.isCurrentUserOwner && room.members.length === 1
            ? '방 보관하고 나가기'
            : '책방 나가기'}
        </button>
      </section>

      {pendingAction ? (
        <RoomManagementConfirmDialog
          action={pendingAction}
          isPending={memberMutation.isPending}
          onCancel={() => setPendingAction(null)}
          onConfirm={handleConfirmAction}
        />
      ) : null}
      {memberMutation.isError ? (
        <p className="mt-4 text-sm text-red-600" role="alert">
          요청을 처리하지 못했어요. 방장 권한과 멤버 상태를 확인해 주세요.
        </p>
      ) : null}
    </main>
  )
}

/** 프로필 식별자가 있는 멤버에게만 같은 책방 안의 프로필 진입 CTA를 제공한다. */
function MemberProfileLink({ member, roomId }: { member: RoomManagementMember; roomId: string }) {
  const memberContent = (
    <>
      <span className="text-ink block text-sm font-semibold">
        {member.displayName}
        {member.isCurrentUser ? ' (나)' : ''}
      </span>
      <span className="text-ink-subtle mt-1 block text-xs">
        {member.role === 'owner' ? '방장' : '멤버'}
      </span>
    </>
  )

  if (member.profileId === null) return <span className="min-w-0 flex-1">{memberContent}</span>

  return (
    <Link
      aria-label={`${member.displayName} 프로필 보기`}
      className="focus-visible:outline-primary min-w-0 flex-1 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2"
      to={`/rooms/${roomId}/members/${member.profileId}`}
    >
      {memberContent}
    </Link>
  )
}

/** 멤버마다 제공되는 방장 관리 동작을 렌더링한다. */
function MemberMenu({
  member,
  onRemove,
  onTransfer,
}: {
  member: RoomManagementMember
  onRemove: () => void
  onTransfer: () => void
}) {
  return (
    <details className="relative">
      <summary
        className="border-ink/10 text-ink flex min-h-11 min-w-11 list-none items-center justify-center rounded-md border text-xl"
        aria-label={`${member.displayName} 관리`}
      >
        ⋯
      </summary>
      <div className="border-ink/10 absolute right-0 z-10 mt-2 w-32 rounded-md border bg-white p-1 shadow-lg">
        <button
          className="text-ink hover:bg-surface-muted min-h-11 w-full rounded-sm px-3 text-left text-sm"
          onClick={onTransfer}
          type="button"
        >
          방장 이양
        </button>
        <button
          className="hover:bg-surface-muted min-h-11 w-full rounded-sm px-3 text-left text-sm text-red-600"
          onClick={onRemove}
          type="button"
        >
          내보내기
        </button>
      </div>
    </details>
  )
}

/** 위험하거나 되돌리기 어려운 방 관리 행동을 다시 확인한다. */
function RoomManagementConfirmDialog({
  action,
  isPending,
  onCancel,
  onConfirm,
}: {
  action: Exclude<PendingAction, null>
  isPending: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const content = getActionContent(action)
  return (
    <div
      aria-modal="true"
      className="bg-ink/30 fixed inset-0 z-30 flex items-end justify-center px-4 pb-4"
      role="dialog"
    >
      <div className="app-page rounded-lg bg-white p-6">
        <h2 className="text-ink text-lg font-bold">{content.title}</h2>
        <p className="text-ink-subtle mt-2 text-sm">{content.description}</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            className="border-ink/10 min-h-12 rounded-md border text-sm font-semibold"
            disabled={isPending}
            onClick={onCancel}
            type="button"
          >
            취소
          </button>
          <button
            className="bg-primary min-h-12 rounded-md text-sm font-semibold text-white disabled:opacity-50"
            disabled={isPending}
            onClick={onConfirm}
            type="button"
          >
            {isPending ? '처리 중…' : content.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

/** 확인창에 표시할 행동별 문구를 만든다. */
function getActionContent(action: Exclude<PendingAction, null>) {
  if (action.type === 'remove')
    return {
      confirmLabel: '내보내기',
      description: `${action.member.displayName}님은 이 방의 대화를 더 이상 볼 수 없어요.`,
      title: '멤버를 내보낼까요?',
    }
  if (action.type === 'transfer')
    return {
      confirmLabel: '방장 이양',
      description: `${action.member.displayName}님에게 방장 권한을 넘겨요. 이 작업은 바로 적용돼요.`,
      title: '방장 권한을 이양할까요?',
    }
  if (action.type === 'archive')
    return {
      confirmLabel: '보관하고 나가기',
      description: '지난 기록에서 다시 볼 수 있지만, 새 대화는 남길 수 없어요.',
      title: '이 방을 보관할까요?',
    }
  return {
    confirmLabel: '나가기',
    description: '대화는 방에 남고, 다시 참여하려면 초대 코드가 필요해요.',
    title: '책방을 나갈까요?',
  }
}

/** 관리 대상 방이 없을 때 복귀를 안내한다. */
function RoomManagementUnavailablePage({ onBack }: { onBack: () => void }) {
  return (
    <main className="app-page bg-surface flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="text-ink text-lg font-bold">이 책방을 찾을 수 없어요</p>
      <button
        className="bg-primary mt-6 min-h-11 rounded-md px-4 text-sm font-semibold text-white"
        onClick={onBack}
        type="button"
      >
        내 책방으로
      </button>
    </main>
  )
}

/** 방 관리 정보를 기다리는 동안 책 로더를 렌더링한다. */
function RoomManagementLoadingPage() {
  return (
    <main className="app-page bg-surface flex min-h-screen items-center justify-center px-4">
      <LoadingSpinner label="방 정보를 불러오고 있어요." variant="book" />
    </main>
  )
}
