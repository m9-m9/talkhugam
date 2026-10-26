import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CommunityRoomDetailPage } from './CommunityRoomDetailPage'

const { getCommunityMessages, getCommunityRoom } = vi.hoisted(() => ({
  getCommunityMessages: vi.fn(),
  getCommunityRoom: vi.fn(),
}))

vi.mock('../../entities/community', () => ({
  banCommunityMember: vi.fn(),
  communityKeys: {
    detail: (roomId: string) => ['community-rooms', 'detail', roomId],
    messages: (roomId: string) => ['community-rooms', 'messages', roomId],
  },
  getCommunityMessages,
  getCommunityRoom,
  reportCommunityTarget: vi.fn(),
  sendCommunityMessage: vi.fn(),
}))

vi.mock('../../shared/api/supabaseClient', () => ({ createSupabaseClient: vi.fn() }))

const roomId = '22222222-2222-4222-8222-222222222222'
const currentMemberId = '33333333-3333-4333-8333-333333333333'
const messages = [
  {
    body: '방장 공지',
    createdAt: '2026-10-27T00:00:00.000Z',
    id: '44444444-4444-4444-8444-444444444441',
    senderDisplayName: '방장',
    senderMemberId: '55555555-5555-4555-8555-555555555551',
    senderRole: 'owner',
  },
  {
    body: '운영 안내',
    createdAt: '2026-10-27T00:01:00.000Z',
    id: '44444444-4444-4444-8444-444444444442',
    senderDisplayName: '다른 운영자',
    senderMemberId: '55555555-5555-4555-8555-555555555552',
    senderRole: 'manager',
  },
  {
    body: '반가워요',
    createdAt: '2026-10-27T00:02:00.000Z',
    id: '44444444-4444-4444-8444-444444444443',
    senderDisplayName: '참여자',
    senderMemberId: '55555555-5555-4555-8555-555555555553',
    senderRole: 'member',
  },
]

describe('CommunityRoomDetailPage', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('shows ban only on regular member messages for a manager', async () => {
    getCommunityRoom.mockResolvedValue({
      currentMemberId,
      currentMemberRole: 'manager',
      description: null,
      id: roomId,
      isOwner: false,
      name: '주말 독서회',
    })
    getCommunityMessages.mockResolvedValue(messages)

    renderCommunityRoomDetailPage()

    expect(await screen.findByText('반가워요')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '퇴장·차단' })).toHaveLength(1)
  })

  it('hides ban for a regular member', async () => {
    getCommunityRoom.mockResolvedValue({
      currentMemberId,
      currentMemberRole: 'member',
      description: null,
      id: roomId,
      isOwner: false,
      name: '주말 독서회',
    })
    getCommunityMessages.mockResolvedValue(messages)

    renderCommunityRoomDetailPage()

    expect(await screen.findByText('반가워요')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '퇴장·차단' })).not.toBeInTheDocument()
  })
})

/** 오픈 책방 상세 화면을 라우터와 서버 상태 Provider 안에서 렌더링한다. */
function renderCommunityRoomDetailPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/community/${roomId}`]}>
        <Routes>
          <Route path="/community/:roomId" element={<CommunityRoomDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
