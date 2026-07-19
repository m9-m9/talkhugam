import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RoomsPage } from './RoomsPage'

const { getReadingRooms } = vi.hoisted(() => ({ getReadingRooms: vi.fn() }))
const { getUnreadNotificationCount } = vi.hoisted(() => ({ getUnreadNotificationCount: vi.fn() }))
const { getBookBestsellers } = vi.hoisted(() => ({ getBookBestsellers: vi.fn() }))

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

vi.mock('../../entities/bestseller', () => ({
  bookBestsellerKeys: { current: ['book-bestsellers'] },
  getBookBestsellers,
}))

describe('RoomsPage', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    getUnreadNotificationCount.mockResolvedValue(0)
    getBookBestsellers.mockResolvedValue({ isConfigured: false, items: [] })
  })

  it('renders the rooms returned by the room repository', async () => {
    getReadingRooms.mockResolvedValue([
      {
        createdAt: '2026-07-17T00:00:00.000Z',
        description: null,
        id: 'room-1',
        lastMessage: null,
        members: [{ displayName: '민규', joinedAt: '2026-07-17T00:00:00.000Z' }],
        name: '금요일 아침 책방',
        updatedAt: '2026-07-17T00:00:00.000Z',
      },
    ])

    renderRoomsPage()

    expect(await screen.findByText('금요일 아침 책방')).toBeInTheDocument()
    expect(screen.getByText('민규: 여기가 좋더라')).toBeInTheDocument()
  })

  it('shows the configured bestseller cards above the member book rooms', async () => {
    getReadingRooms.mockResolvedValue([])
    getBookBestsellers.mockResolvedValue({
      isConfigured: true,
      items: [
        {
          authors: ['기시미 이치로'],
          externalUrl: 'https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=1',
          id: '9788996991342',
          isbn13: '9788996991342',
          publisher: '인플루엔셜',
          thumbnailUrl: 'https://image.aladin.co.kr/product/1/1/cover500/1.jpg',
          title: '미움받을 용기',
        },
      ],
    })

    renderRoomsPage()

    await waitFor(() => expect(getReadingRooms).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(getBookBestsellers).toHaveBeenCalledTimes(1))
    expect(
      await screen.findByRole('heading', { level: 2, name: '이번 주 베스트셀러' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '미움받을 용기 자세히 보기' })).toHaveAttribute(
      'href',
      'https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=1',
    )
  })

  it('opens the notification inbox with the unread count in the accessible label', async () => {
    getReadingRooms.mockResolvedValue([])
    getUnreadNotificationCount.mockResolvedValue(3)
    renderRoomsPage()

    fireEvent.click(await screen.findByRole('button', { name: '알림함, 읽지 않은 알림 3개' }))

    expect(await screen.findByText('알림함 화면')).toBeInTheDocument()
  })

  it('keeps the reading room heading when the member has no rooms yet', async () => {
    getReadingRooms.mockResolvedValue([])
    const { findByRole } = renderRoomsPage()

    expect(await findByRole('heading', { level: 2, name: '함께 읽는 책방' })).toBeInTheDocument()
  })

  it('keeps the reading room heading while the room list is loading', () => {
    getReadingRooms.mockReturnValue(new Promise<never>(() => undefined))
    const { getByRole } = renderRoomsPage()

    expect(getByRole('heading', { level: 2, name: '함께 읽는 책방' })).toBeInTheDocument()
  })

  it('keeps the reading room heading when the room list cannot be loaded', async () => {
    getReadingRooms.mockRejectedValue(new Error('책방 조회 실패'))
    const { findByRole, findByText } = renderRoomsPage()

    expect(await findByText('책방을 불러오지 못했어요')).toBeInTheDocument()
    expect(await findByRole('heading', { level: 2, name: '함께 읽는 책방' })).toBeInTheDocument()
  })
})

/** 독서방 목록 테스트에 필요한 Query와 라우터 경계를 렌더링한다. */
function renderRoomsPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
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
