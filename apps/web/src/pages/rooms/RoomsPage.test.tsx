import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { RoomsPage } from './RoomsPage'

const { getReadingRooms } = vi.hoisted(() => ({ getReadingRooms: vi.fn() }))
const { getUnreadNotificationCount } = vi.hoisted(() => ({ getUnreadNotificationCount: vi.fn() }))

vi.mock('../../entities/reading-room', () => ({
  formatRoomMemberSummary: () => '민규 · 1명',
  formatRoomMessagePreview: () => '민규: 여기가 좋더라',
  formatRoomMessageTime: () => '20:30',
  getReadingRooms,
  readingRoomKeys: { all: ['reading-rooms'] },
}))

vi.mock('../../shared/api/supabaseClient', () => ({ createSupabaseClient: vi.fn() }))

vi.mock('../../entities/notification', () => ({
  getUnreadNotificationCount,
  notificationKeys: { unreadCount: ['notifications', 'unread-count'] },
}))

describe('RoomsPage', () => {
  it('renders the rooms returned by the room repository', async () => {
    getReadingRooms.mockResolvedValue([
      {
        createdAt: '2026-07-17T00:00:00.000Z',
        description: null,
        id: 'room-1',
        lastMessage: null,
        members: [{ displayName: '민규', joinedAt: '2026-07-17T00:00:00.000Z' }],
        name: '금요일 아침 독서 모임',
        updatedAt: '2026-07-17T00:00:00.000Z',
      },
    ])

    renderRoomsPage()

    expect(await screen.findByText('금요일 아침 독서 모임')).toBeInTheDocument()
    expect(screen.getByText('민규: 여기가 좋더라')).toBeInTheDocument()
  })

  it('opens the notification inbox with the unread count in the accessible label', async () => {
    getReadingRooms.mockResolvedValue([])
    getUnreadNotificationCount.mockResolvedValue(3)
    renderRoomsPage()

    fireEvent.click(await screen.findByRole('button', { name: '알림함, 읽지 않은 알림 3개' }))

    expect(await screen.findByText('알림함 화면')).toBeInTheDocument()
  })
})

function renderRoomsPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/rooms']}>
        <Routes>
          <Route path="/rooms" element={<RoomsPage />} />
          <Route path="/notifications" element={<p>알림함 화면</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
