import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ActionButton, Dialog } from '@seed-design/react'

import {
  createManagedRoomInvite,
  getRoomManagement,
  leaveManagedRoom,
  removeManagedRoomMember,
  roomManagementKeys,
  transferManagedRoomOwnership,
  updateManagedRoomMemberRole,
  type CreatedManagedRoomInvite,
  type RoomManagementMember,
} from '../../entities/room-management'
import {
  copyInviteText,
  createInviteShareData,
  getInviteCopyText,
  getInvitePlatformUrl,
  InviteShareActions,
  shareInviteWithKakao,
  type InviteSharePlatform,
} from '../../features/invite-sharing'
import { readingRoomKeys } from '../../entities/reading-room'
import { useAuthenticatedUser } from '../../features/auth'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { getClientEnv } from '../../app/env'
import { AppHeader } from '../../shared/ui/AppHeader'
import { BookLoadingIndicator, BrandLoadingSpinner } from '../../shared/ui/LoadingSpinner'

type PendingAction =
  | { member: RoomManagementMember; type: 'remove' | 'transfer' | 'make-manager' | 'make-member' }
  | { type: 'archive' | 'leave' }
  | null

/** 방장과 멤버가 방 정보, 초대, 멤버 구성을 관리하는 화면을 렌더링한다. */
export function RoomManagementPage() {
  const client = createSupabaseClient()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthenticatedUser()
  const { roomId } = useParams()
  const [createdInvite, setCreatedInvite] = useState<CreatedManagedRoomInvite | null>(null)
  const [inviteShareError, setInviteShareError] = useState<string | null>(null)
  const [inviteShareMessage, setInviteShareMessage] = useState<string | null>(null)
  const [isInviteShareOptionsVisible, setIsInviteShareOptionsVisible] = useState(false)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const roomQuery = useQuery({
    enabled: Boolean(roomId),
    queryFn: () => getRoomManagement(client, roomId ?? '', user.id),
    queryKey: roomManagementKeys.detail(roomId ?? ''),
  })
  const inviteMutation = useMutation({
    mutationFn: () => createManagedRoomInvite(client, roomId ?? ''),
    onSuccess: (invite) => {
      setCreatedInvite(invite)
      setIsInviteShareOptionsVisible(false)
    },
  })
  const memberMutation = useMutation({
    mutationFn: async (action: Exclude<PendingAction, null>) => {
      if (action.type === 'remove')
        return removeManagedRoomMember(client, roomId ?? '', action.member.id)
      if (action.type === 'transfer')
        return transferManagedRoomOwnership(client, roomId ?? '', action.member.id)
      if (action.type === 'make-manager' || action.type === 'make-member')
        return updateManagedRoomMemberRole(
          client,
          roomId ?? '',
          action.member.id,
          action.type === 'make-manager' ? 'manager' : 'member',
        )
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

  /** 선택한 채널의 지원 범위에 맞춰 초대 링크와 코드를 전달한다. */
  async function handleShareInvite(platform: InviteSharePlatform) {
    if (createdInvite === null) return

    const shareData = createInviteShareData(window.location.origin, room.name, createdInvite)
    setInviteShareError(null)
    setInviteShareMessage(null)

    try {
      if (platform === 'kakao') {
        const javascriptKey = getClientEnv().VITE_KAKAO_JAVASCRIPT_KEY
        if (javascriptKey) {
          try {
            await shareInviteWithKakao(shareData, javascriptKey)
          } catch {
            await shareWithDevice(shareData)
          }
        } else await shareWithDevice(shareData)
        setInviteShareMessage('카카오톡에서 보낼 초대 내용을 준비했어요.')
        return
      }

      if (platform === 'instagram') {
        await copyInviteText(getInviteCopyText(shareData))
        openInvitePlatform(platform, shareData)
        setInviteShareMessage('초대 문구를 복사했어요. 인스타그램에서 붙여 넣어 보내 보세요.')
        return
      }

      openInvitePlatform(platform, shareData)
      setInviteShareMessage(`${getInviteSharePlatformName(platform)}으로 초대 링크를 열었어요.`)
    } catch (error) {
      if (isShareCancellation(error)) return
      setInviteShareError('초대 내용을 공유하지 못했어요. 다시 시도해 주세요.')
    }
  }

  /** 생성한 초대 코드와 링크를 한 번에 클립보드에 복사한다. */
  async function handleCopyInvite() {
    if (createdInvite === null) return

    setInviteShareError(null)
    setInviteShareMessage(null)

    try {
      const shareData = createInviteShareData(window.location.origin, room.name, createdInvite)
      await copyInviteText(getInviteCopyText(shareData))
      setInviteShareMessage('초대 코드와 링크를 복사했어요.')
    } catch {
      setInviteShareError('초대 링크를 복사하지 못했어요. 다시 시도해 주세요.')
    }
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

      {room.currentUserRole === 'owner' || room.currentUserRole === 'manager' ? (
        <section className="mt-8" aria-labelledby="room-management-actions">
          <h2 className="text-ink text-base font-bold" id="room-management-actions">
            방 관리
          </h2>
          <div
            className={`mt-4 grid gap-3 ${room.isCurrentUserOwner ? 'grid-cols-2' : 'grid-cols-1'}`}
          >
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
          {inviteMutation.isPending ? (
            <div className="mt-4">
              <BrandLoadingSpinner label="초대 코드를 만들고 있어요." size="xs" />
            </div>
          ) : null}
          {inviteMutation.isError ? (
            <p className="mt-3 text-sm text-red-600" role="alert">
              초대 코드를 만들지 못했어요. 다시 시도해 주세요.
            </p>
          ) : null}
          {createdInvite ? (
            <div className="talkhugam-information-surface border-border mt-4 rounded-lg border p-4">
              <p className="text-ink-subtle text-xs">지금 한 번만 확인할 수 있는 초대 코드예요.</p>
              <p className="text-ink mt-2 text-2xl font-bold tracking-[0.2em]">
                {createdInvite.code}
              </p>
              <ActionButton
                className="talkhugam-primary-action mt-4 w-full"
                aria-expanded={isInviteShareOptionsVisible}
                onClick={() => setIsInviteShareOptionsVisible(true)}
                size="large"
                type="button"
                variant="brandSolid"
              >
                친구에게 공유하기
              </ActionButton>
              <p className="text-ink-subtle mt-2 text-xs">
                카카오톡, 문자, 인스타그램, 페이스북으로 초대할 수 있어요.
              </p>
              {isInviteShareOptionsVisible ? (
                <section aria-label="초대 공유 옵션">
                  <InviteShareActions
                    onCopyInvite={() => void handleCopyInvite()}
                    onShare={(platform) => void handleShareInvite(platform)}
                  />
                </section>
              ) : null}
              {inviteShareMessage ? (
                <p className="text-primary mt-2 text-xs" role="status">
                  {inviteShareMessage}
                </p>
              ) : null}
              {inviteShareError ? (
                <p className="mt-2 text-xs text-red-600" role="alert">
                  {inviteShareError}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="mt-12" aria-labelledby="room-members-heading">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-ink text-base font-bold" id="room-members-heading">
            함께하는 사람 {room.members.length}명
          </h2>
          {room.currentUserRole === 'owner' || room.currentUserRole === 'manager' ? (
            <span className="text-ink-subtle text-xs">
              {room.isCurrentUserOwner
                ? '방장이 역할을 관리할 수 있어요'
                : '운영자가 초대와 책을 관리해요'}
            </span>
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
                  onMakeManager={() => setPendingAction({ member, type: 'make-manager' })}
                  onMakeMember={() => setPendingAction({ member, type: 'make-member' })}
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
        <ActionButton
          className="mt-4 w-full"
          onClick={() =>
            setPendingAction({
              type: room.isCurrentUserOwner && room.members.length === 1 ? 'archive' : 'leave',
            })
          }
          size="large"
          type="button"
          variant="neutralOutline"
        >
          {room.isCurrentUserOwner && room.members.length === 1
            ? '방 보관하고 나가기'
            : '책방 나가기'}
        </ActionButton>
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

/** 공유 대상을 이용자에게 자연스럽게 안내할 한국어 이름으로 반환한다. */
function getInviteSharePlatformName(platform: InviteSharePlatform): string {
  if (platform === 'sms') return '문자'
  if (platform === 'kakao') return '카카오톡'
  if (platform === 'instagram') return '인스타그램'
  return '페이스북'
}

/** 기기 공유 API가 있으면 사용하고, 없으면 초대 문구를 복사한다. */
async function shareWithDevice(shareData: {
  text: string
  title: string
  url: string
}): Promise<void> {
  if (typeof navigator.share === 'function') {
    await navigator.share(shareData)
    return
  }
  await copyInviteText(getInviteCopyText(shareData))
}

/** 브라우저에서 지원하는 채널의 공유 주소를 새 창으로 연다. */
function openInvitePlatform(
  platform: Exclude<InviteSharePlatform, 'kakao'>,
  shareData: {
    text: string
    title: string
    url: string
  },
) {
  const platformUrl = getInvitePlatformUrl(platform, shareData)
  if (platformUrl === null) return
  window.open(platformUrl, '_blank', 'noopener,noreferrer')
}

/** 기기 공유 시트에서 사용자가 취소한 오류인지 판별한다. */
function isShareCancellation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  return 'name' in error && error.name === 'AbortError'
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
        {member.role === 'owner' ? '방장' : member.role === 'manager' ? '운영자' : '참여자'}
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
  onMakeManager,
  onMakeMember,
  onRemove,
  onTransfer,
}: {
  member: RoomManagementMember
  onMakeManager: () => void
  onMakeMember: () => void
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
        <ActionButton
          className="text-ink hover:!bg-surface-muted min-h-11 w-full justify-start rounded-sm px-3 text-left"
          onClick={member.role === 'manager' ? onMakeMember : onMakeManager}
          size="medium"
          type="button"
          variant="ghost"
        >
          {member.role === 'manager' ? '참여자로 변경' : '운영자로 변경'}
        </ActionButton>
        <ActionButton
          className="text-ink hover:!bg-surface-muted min-h-11 w-full justify-start rounded-sm px-3 text-left"
          onClick={onTransfer}
          size="medium"
          type="button"
          variant="ghost"
        >
          방장 이양
        </ActionButton>
        <ActionButton
          className="hover:!bg-surface-muted min-h-11 w-full justify-start rounded-sm px-3 text-left text-red-600"
          onClick={onRemove}
          size="medium"
          type="button"
          variant="ghost"
        >
          내보내기
        </ActionButton>
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

  /** SEED 대화상자가 닫힘을 요청하면 처리 중이 아닐 때만 관리 동작을 취소한다. */
  function handleOpenChange(open: boolean) {
    if (open || isPending) return
    onCancel()
  }

  return (
    <Dialog.Root onOpenChange={handleOpenChange} open>
      <Dialog.Positioner>
        <Dialog.Backdrop />
        <Dialog.Content className="talkhugam-room-management-dialog">
          <Dialog.Header>
            <Dialog.Title>{content.title}</Dialog.Title>
            <Dialog.Description>{content.description}</Dialog.Description>
          </Dialog.Header>
          <Dialog.Footer>
            <ActionButton
              disabled={isPending}
              onClick={onCancel}
              size="large"
              type="button"
              variant="neutralOutline"
            >
              취소
            </ActionButton>
            <ActionButton
              className="talkhugam-primary-action"
              disabled={isPending}
              loading={isPending}
              onClick={onConfirm}
              size="large"
              type="button"
              variant="brandSolid"
            >
              {content.confirmLabel}
            </ActionButton>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
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
  if (action.type === 'make-manager' || action.type === 'make-member')
    return {
      confirmLabel: '권한 변경 저장',
      description: `${action.member.displayName}님의 역할을 ${action.type === 'make-manager' ? '운영자' : '참여자'}로 변경해요.`,
      title: '권한을 변경할까요?',
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

/** 방 관리 정보를 기다리는 동안 책 로더를 렌더링한다. */
function RoomManagementLoadingPage() {
  return (
    <main className="app-page bg-surface flex min-h-screen items-center justify-center px-4">
      <BookLoadingIndicator label="방 정보를 불러오고 있어요." />
    </main>
  )
}
