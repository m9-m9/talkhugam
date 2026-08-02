import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

  it('opens a room from the list content without expanding into the suffix area', async () => {
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

    fireEvent.click(await screen.findByRole('button', { name: '금요일 아침 책방 책방 열기' }))

    expect(await screen.findByText('책방 상세 화면')).toBeInTheDocument()
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

  it('현재 추천을 넓게 보여 주고 다음 추천 세 권을 미리 볼 수 있다', async () => {
    getReadingRooms.mockResolvedValue([])
    getBookBestsellers.mockResolvedValue({
      isConfigured: true,
      items: [
        createBestseller('첫 번째 책'),
        createBestseller('두 번째 책'),
        createBestseller('세 번째 책'),
        createBestseller('네 번째 책'),
      ],
    })

    renderRoomsPage()

    expect(await screen.findByRole('heading', { level: 3, name: '첫 번째 책' })).toBeInTheDocument()
    const previewList = screen.getByRole('list', { name: '다른 추천 도서' })
    expect(previewList).toHaveClass('grid-cols-3')
    expect(within(previewList).getAllByRole('button', { name: /추천 보기$/ })).toHaveLength(3)

    fireEvent.click(screen.getByRole('button', { name: '다음 추천 보기' }))

    expect(await screen.findByRole('heading', { level: 3, name: '두 번째 책' })).toBeInTheDocument()
  })

  it('다음 추천으로 이동할 때 카드 트랙을 부드럽게 한 칸 이동한다', async () => {
    getReadingRooms.mockResolvedValue([])
    getBookBestsellers.mockResolvedValue({
      isConfigured: true,
      items: [createBestseller('첫 번째 책'), createBestseller('두 번째 책')],
    })

    renderRoomsPage()

    const track = await screen.findByTestId('bestseller-track')
    expect(track).toHaveStyle({ transform: 'translateX(-0%)' })
    expect(track).toHaveClass('transition-transform', 'duration-500')

    fireEvent.click(screen.getByRole('button', { name: '다음 추천 보기' }))

    expect(track).toHaveStyle({ transform: 'translateX(-100%)' })
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

  it('waits for the room list and bestseller response before rendering main content', () => {
    getReadingRooms.mockReturnValue(new Promise<never>(() => undefined))
    const { getByRole, queryByRole } = renderRoomsPage()

    expect(getByRole('status', { name: '책방을 준비하고 있어요.' })).toBeInTheDocument()
    expect(queryByRole('heading', { level: 2, name: '함께 읽는 책방' })).not.toBeInTheDocument()
  })

  it('keeps the main content hidden while the bestseller response is still loading', () => {
    getReadingRooms.mockResolvedValue([])
    getBookBestsellers.mockReturnValue(new Promise<never>(() => undefined))
    const { getByRole, queryByRole } = renderRoomsPage()

    expect(getByRole('status', { name: '책방을 준비하고 있어요.' })).toBeInTheDocument()
    expect(queryByRole('heading', { level: 2, name: '함께 읽는 책방' })).not.toBeInTheDocument()
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
          <Route path="/rooms/:roomId" element={<p>책방 상세 화면</p>} />
          <Route path="/notifications" element={<p>알림함 화면</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** 캐러셀 테스트에 필요한 최소 베스트셀러 데이터를 만든다. */
function createBestseller(title: string) {
  return {
    authors: ['테스트 저자'],
    externalUrl: null,
    id: title,
    isbn13: null,
    publisher: null,
    thumbnailUrl: null,
    title,
  }
}
