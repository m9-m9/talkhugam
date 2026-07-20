import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomManagementPage } from './RoomManagementPage'

const { createManagedRoomInvite, getRoomManagement } = vi.hoisted(() => ({
  createManagedRoomInvite: vi.fn().mockResolvedValue({
    code: 'TALK87',
    expiresAt: '2026-07-20T00:00:00.000Z',
    id: '00000000-0000-0000-0000-000000000011',
    token: 'a'.repeat(64),
  }),
  getRoomManagement: vi.fn().mockResolvedValue({
    createdBy: '00000000-0000-0000-0000-000000000001',
    description: null,
    id: '00000000-0000-0000-0000-000000000101',
    isCurrentUserOwner: true,
    members: [],
    name: '금요일 아침 책방',
    status: 'active',
  }),
}))

vi.mock('../../entities/room-management', () => ({
  createManagedRoomInvite,
  getRoomManagement,
  leaveManagedRoom: vi.fn(),
  removeManagedRoomMember: vi.fn(),
  roomManagementKeys: { detail: (roomId: string) => ['room-management', roomId] },
  transferManagedRoomOwnership: vi.fn(),
}))

vi.mock('../../entities/reading-room', () => ({ readingRoomKeys: { all: ['reading-rooms'] } }))

vi.mock('../../features/auth', () => ({
  useAuthenticatedUser: () => ({ id: '00000000-0000-0000-0000-000000000001' }),
}))

vi.mock('../../shared/api/supabaseClient', () => ({ createSupabaseClient: vi.fn() }))

vi.mock('../../app/env', () => ({
  getClientEnv: () => ({
    VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
    VITE_SUPABASE_URL: 'https://talkhugam.supabase.co',
  }),
}))

describe('RoomManagementPage', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined })
  })

  it('opens platform choices after creating an invite code', async () => {
    renderRoomManagementPage()

    fireEvent.click(await screen.findByRole('button', { name: '초대 코드 만들기' }))
    expect(await screen.findByRole('dialog', { name: '책방 초대하기' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '카카오톡으로 초대 보내기' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '문자로 초대 보내기' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '인스타그램으로 초대 보내기' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '페이스북으로 초대 보내기' })).toBeInTheDocument()
  })

  it('copies the invite message when the device share sheet is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    renderRoomManagementPage()

    fireEvent.click(await screen.findByRole('button', { name: '초대 코드 만들기' }))
    fireEvent.click(await screen.findByRole('button', { name: '카카오톡으로 초대 보내기' }))

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        '금요일 아침 책방에 초대해요.\n초대 코드: TALK87\nTalk후감에서 코드를 입력해 함께 읽기 시작해요.\nhttp://localhost:3000/rooms/join?invite=' +
          'a'.repeat(64),
      ),
    )
  })

  it('does not show an error when the user closes the device share sheet', async () => {
    const share = vi
      .fn()
      .mockRejectedValue(new DOMException('사용자가 공유를 취소했어요.', 'AbortError'))
    Object.defineProperty(navigator, 'share', { configurable: true, value: share })
    renderRoomManagementPage()

    fireEvent.click(await screen.findByRole('button', { name: '초대 코드 만들기' }))
    fireEvent.click(await screen.findByRole('button', { name: '카카오톡으로 초대 보내기' }))

    await waitFor(() => expect(share).toHaveBeenCalled())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('explains when invite sharing fails for a reason other than cancellation', async () => {
    const share = vi.fn().mockRejectedValue(new Error('share unavailable'))
    Object.defineProperty(navigator, 'share', { configurable: true, value: share })
    renderRoomManagementPage()

    fireEvent.click(await screen.findByRole('button', { name: '초대 코드 만들기' }))
    fireEvent.click(await screen.findByRole('button', { name: '카카오톡으로 초대 보내기' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '초대 내용을 공유하지 못했어요. 다시 시도해 주세요.',
    )
  })
})

/** 방 정보 화면을 라우터와 서버 상태 Provider 안에서 렌더링한다. */
function renderRoomManagementPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/rooms/00000000-0000-0000-0000-000000000101/manage']}>
        <Routes>
          <Route element={<RoomManagementPage />} path="/rooms/:roomId/manage" />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
