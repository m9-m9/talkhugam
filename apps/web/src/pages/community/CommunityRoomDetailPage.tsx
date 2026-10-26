import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ActionButton, TextField } from '@seed-design/react'
import { canBanCommunityMember } from '@talkhugam/domain'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import {
  banCommunityMember,
  communityKeys,
  getCommunityMessages,
  getCommunityRoom,
  reportCommunityTarget,
  sendCommunityMessage,
} from '../../entities/community'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { AppHeader } from '../../shared/ui/AppHeader'
import { BookLoadingIndicator } from '../../shared/ui/LoadingSpinner'

/** 활성 오픈 책방 멤버의 자유 채팅, 방장·운영자 제재, 신고 동작을 렌더링한다. */
export function CommunityRoomDetailPage() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [body, setBody] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const roomQuery = useQuery({
    enabled: Boolean(roomId),
    queryFn: () => getCommunityRoom(createSupabaseClient(), roomId ?? ''),
    queryKey: communityKeys.detail(roomId ?? ''),
  })
  const messagesQuery = useQuery({
    enabled: Boolean(roomId),
    queryFn: () => getCommunityMessages(createSupabaseClient(), roomId ?? ''),
    queryKey: communityKeys.messages(roomId ?? ''),
  })

  /** 자유 채팅을 작성한 뒤 현재 방의 메시지 캐시를 갱신한다. */
  async function handleSend() {
    if (!roomId || body.trim().length === 0) return
    try {
      await sendCommunityMessage(createSupabaseClient(), roomId, body)
      setBody('')
      await queryClient.invalidateQueries({ queryKey: communityKeys.messages(roomId) })
    } catch {
      setErrorMessage('메시지를 보내지 못했어요.')
    }
  }
  /** 방장·운영자 권한으로 메시지를 남긴 멤버를 제재하고 방 데이터를 새로고침한다. */
  async function handleBan(memberId: string) {
    if (!roomId) return
    try {
      await banCommunityMember(createSupabaseClient(), roomId, memberId)
      await queryClient.invalidateQueries({ queryKey: communityKeys.messages(roomId) })
    } catch {
      setErrorMessage('멤버를 제재하지 못했어요.')
    }
  }
  /** 현재 오픈 책방을 운영 검토 대상으로 신고한다. */
  async function handleReport() {
    if (!roomId) return
    try {
      await reportCommunityTarget(createSupabaseClient(), 'room', roomId, '운영자 확인이 필요해요')
      setErrorMessage('신고를 접수했어요.')
    } catch {
      setErrorMessage('신고를 접수하지 못했어요.')
    }
  }

  if (roomQuery.isPending)
    return (
      <main className="bg-surface flex min-h-screen items-center justify-center">
        <BookLoadingIndicator label="오픈 책방을 불러오고 있어요." />
      </main>
    )
  if (!roomQuery.data)
    return (
      <main className="app-page bg-surface px-4">
        <AppHeader onBack={() => void navigate('/community')} title="오픈 책방" />
        <p className="text-ink mt-12 text-center">이 책방에 접근할 수 없어요.</p>
      </main>
    )
  return (
    <main className="app-page bg-surface flex min-h-screen flex-col px-4 pb-4">
      <AppHeader
        action={
          <ActionButton
            className="text-ink min-h-11"
            onClick={() => void handleReport()}
            size="small"
            type="button"
            variant="ghost"
          >
            신고
          </ActionButton>
        }
        onBack={() => void navigate('/community')}
        title="오픈 책방"
      />
      <header className="mt-6">
        <h1 className="text-ink text-xl font-bold">{roomQuery.data.name}</h1>
        {roomQuery.data.description ? (
          <p className="text-ink-subtle mt-2 text-sm">{roomQuery.data.description}</p>
        ) : null}
      </header>
      <section className="mt-8 flex-1" aria-label="자유 채팅">
        {messagesQuery.isPending ? (
          <BookLoadingIndicator label="자유 채팅을 불러오고 있어요." size="sm" />
        ) : (
          <ul className="space-y-3">
            {messagesQuery.data?.map((message) => (
              <li className="border-border rounded-lg border p-3" key={message.id}>
                <p className="text-ink text-sm font-semibold">{message.senderDisplayName}</p>
                <p className="text-ink mt-1 text-sm">{message.body}</p>
                {canBanCommunityMember(roomQuery.data.currentMemberRole, message.senderRole) &&
                message.senderMemberId !== roomQuery.data.currentMemberId ? (
                  <ActionButton
                    className="mt-2 min-h-11 text-red-600"
                    onClick={() => void handleBan(message.senderMemberId)}
                    size="small"
                    type="button"
                    variant="ghost"
                  >
                    퇴장·차단
                  </ActionButton>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      {errorMessage ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <div className="mt-4 flex gap-2">
        <TextField.Root className="talkhugam-information-field flex-1">
          <TextField.Input
            maxLength={2000}
            onChange={(event) => setBody(event.target.value)}
            placeholder="자유롭게 이야기해 보세요"
            value={body}
          />
        </TextField.Root>
        <ActionButton
          className="talkhugam-primary-action min-h-11"
          onClick={() => void handleSend()}
          size="medium"
          type="button"
          variant="brandSolid"
        >
          보내기
        </ActionButton>
      </div>
    </main>
  )
}
