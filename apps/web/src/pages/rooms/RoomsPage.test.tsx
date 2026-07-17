import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { RoomsPage } from './RoomsPage'

const { getReadingRooms } = vi.hoisted(() => ({ getReadingRooms: vi.fn() }))

vi.mock('../../entities/reading-room', () => ({
  formatRoomMemberSummary: () => '민규 · 1명',
  formatRoomMessagePreview: () => '민규: 여기가 좋더라',
  formatRoomMessageTime: () => '20:30',
  getReadingRooms,
  readingRoomKeys: { all: ['reading-rooms'] },
}))

vi.mock('../../shared/api/supabaseClient', () => ({ createSupabaseClient: vi.fn() }))

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
})

function renderRoomsPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <RoomsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
