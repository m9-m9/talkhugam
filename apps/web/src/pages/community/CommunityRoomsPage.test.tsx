import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CommunityRoomsPage } from './CommunityRoomsPage'

const { getCommunityRooms } = vi.hoisted(() => ({ getCommunityRooms: vi.fn() }))

vi.mock('../../entities/community', () => ({
  communityKeys: { all: ['community-rooms'], discovery: () => ['community-rooms', 'discovery'] },
  getCommunityRooms,
}))

vi.mock('../../shared/api/supabaseClient', () => ({ createSupabaseClient: vi.fn() }))

describe('CommunityRoomsPage', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(cleanup)

  it('팔로우한 생성자의 오픈 책방 표시와 입장 흐름을 렌더링한다', async () => {
    getCommunityRooms.mockResolvedValue([
      {
        access: 'password',
        activeMemberCount: 3,
        capacity: 12,
        createdBy: '11111111-1111-4111-8111-111111111111',
        description: '퇴근 뒤 함께 읽어요.',
        id: '22222222-2222-4222-8222-222222222222',
        isFollowingCreator: true,
        name: '밤 독서회',
      },
    ])

    renderCommunityRoomsPage()

    expect(await screen.findByText('밤 독서회')).toBeInTheDocument()
    expect(screen.getByText('팔로우한 사람이 열었어요')).toBeInTheDocument()
    expect(screen.getByText('비밀번호 필요 · 3 / 12명')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /밤 독서회/ }))

    expect(await screen.findByText('참여 화면')).toBeInTheDocument()
  })

  it('발견 목록 오류에서 재시도로 같은 조회를 다시 요청한다', async () => {
    getCommunityRooms.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce([])

    renderCommunityRoomsPage()

    fireEvent.click(await screen.findByRole('button', { name: '다시 시도' }))

    await waitFor(() => expect(getCommunityRooms).toHaveBeenCalledTimes(2))
    expect(
      await screen.findByText('아직 열린 책방이 없어요. 첫 책방을 열어 보세요.'),
    ).toBeInTheDocument()
  })
})

/** 오픈 책방 발견 화면의 라우터와 서버 상태 Provider를 구성해 렌더링한다. */
function renderCommunityRoomsPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/community']}>
        <Routes>
          <Route element={<CommunityRoomsPage />} path="/community" />
          <Route element={<p>참여 화면</p>} path="/community/:roomId/join" />
          <Route element={<p>내 책방 화면</p>} path="/rooms" />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
