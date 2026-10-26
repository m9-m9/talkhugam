import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomDetailPage } from './RoomDetailPage'

const { getBookChats, getReadingRoom } = vi.hoisted(() => ({
  getBookChats: vi.fn(),
  getReadingRoom: vi.fn(),
}))

vi.mock('../../entities/book-chat', () => ({
  bookChatKeys: {
    byRoom: (roomId: string) => ['book-chats', roomId],
    room: (roomId: string) => ['reading-room', roomId],
  },
  getBookChats,
  getReadingRoom,
}))

vi.mock('../../shared/api/supabaseClient', () => ({ createSupabaseClient: vi.fn() }))

describe('RoomDetailPage', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('opens the selected book conversation from the current reading room', async () => {
    getReadingRoom.mockResolvedValue({
      description: '이번 달의 책',
      id: 'room-1',
      name: '금요일 아침 모임',
    })
    getBookChats.mockResolvedValue([
      {
        authors: ['기시미 이치로'],
        id: 'chat-1',
        name: '미움받을 용기',
        thumbnailUrl: null,
        title: '미움받을 용기',
      },
    ])

    renderRoomDetailPage('/rooms/room-1')

    const bookCard = (await screen.findByText('미움받을 용기')).closest('button')
    if (!bookCard) throw new Error('책 대화 카드 버튼을 찾을 수 없어요.')
    expect(bookCard).toHaveClass('!justify-start')
    expect(bookCard).toHaveClass('talkhugam-information-surface')
    expect(bookCard).not.toHaveClass('!bg-white')
    fireEvent.click(bookCard)

    expect(await screen.findByText('책 대화 화면')).toBeInTheDocument()
  })

  it('uses a white information surface when the room has no books yet', async () => {
    getReadingRoom.mockResolvedValue({ description: null, id: 'room-1', name: '금요일 아침 모임' })
    getBookChats.mockResolvedValue([])

    renderRoomDetailPage('/rooms/room-1')

    expect(
      (await screen.findByText('아직 함께 읽는 책이 없어요')).closest(
        '.talkhugam-information-surface',
      ),
    ).not.toBeNull()
  })

  it('shows only the title and authors on room book cards', async () => {
    getReadingRoom.mockResolvedValue({ description: null, id: 'room-1', name: '금요일 아침 책방' })
    getBookChats.mockResolvedValue([
      {
        authors: ['기시미 이치로'],
        id: 'chat-1',
        name: '미움받을 용기',
        thumbnailUrl: null,
        title: '미움받을 용기',
      },
    ])

    renderRoomDetailPage('/rooms/room-1')

    expect(await screen.findByText('기시미 이치로')).toBeInTheDocument()
    expect(screen.queryByLabelText(/독서 진행률/)).toBeNull()
    expect(screen.queryByText('완독')).toBeNull()
  })

  it('offers a clear route back when the reading room is unavailable', async () => {
    getReadingRoom.mockRejectedValue(new Error('room unavailable'))

    renderRoomDetailPage('/rooms/room-1')

    expect(await screen.findByText('이 책방을 찾을 수 없어요')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '내 책방으로' }))
    expect(await screen.findByText('내 책방 화면')).toBeInTheDocument()
  })

  it('explains when the selected room loads but its book list cannot be loaded', async () => {
    getReadingRoom.mockResolvedValue({ description: null, id: 'room-1', name: '금요일 아침 모임' })
    getBookChats.mockRejectedValue(new Error('book chats unavailable'))

    renderRoomDetailPage('/rooms/room-1')

    expect(await screen.findByRole('alert')).toHaveTextContent('책 목록을 불러오지 못했어요.')
  })

  it('retries the book list query after it fails', async () => {
    getReadingRoom.mockResolvedValue({ description: null, id: 'room-1', name: '금요일 아침 모임' })
    getBookChats.mockRejectedValueOnce(new Error('book chats unavailable')).mockResolvedValueOnce([
      {
        authors: ['기시미 이치로'],
        id: 'chat-1',
        name: '미움받을 용기',
        thumbnailUrl: null,
        title: '미움받을 용기',
      },
    ])

    renderRoomDetailPage('/rooms/room-1')

    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(await screen.findByText('미움받을 용기')).toBeInTheDocument()
    expect(getBookChats).toHaveBeenCalledTimes(2)
  })
})

/** 책방 상세 화면의 라우터와 서버 상태 Provider를 구성해 렌더링한다. */
function renderRoomDetailPage(initialEntry: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/rooms" element={<p>내 책방 화면</p>} />
          <Route path="/rooms/:roomId" element={<RoomDetailPage />} />
          <Route path="/rooms/:roomId/books/:bookChatId" element={<p>책 대화 화면</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
