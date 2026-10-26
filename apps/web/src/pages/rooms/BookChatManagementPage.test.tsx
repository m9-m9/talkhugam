import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BookChatManagementPage } from './BookChatManagementPage'

const bookChatId = '6f1c2b0e-4a5d-4c3b-9e2f-1a2b3c4d5e01'
const roomId = '6f1c2b0e-4a5d-4c3b-9e2f-1a2b3c4d5e02'
const profileId = '6f1c2b0e-4a5d-4c3b-9e2f-1a2b3c4d5e03'

const { getBookChatRatings, getManagedBookChat, upsertBookChatRating } = vi.hoisted(() => ({
  getBookChatRatings: vi.fn().mockResolvedValue([]),
  getManagedBookChat: vi.fn(),
  upsertBookChatRating: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../entities/book-chat', () => ({
  bookChatKeys: {
    byRoom: (targetRoomId: string) => ['book-chats', targetRoomId],
  },
  deleteManagedBookChat: vi.fn(),
  getManagedBookChat,
  updateBookChatStatus: vi.fn(),
}))

vi.mock('../../entities/book-rating', () => ({
  bookRatingKeys: {
    byChat: (targetBookChatId: string) => ['book-ratings', targetBookChatId],
    myBooks: (targetProfileId: string) => ['my-rated-books', targetProfileId],
  },
  getBookChatRatings,
  upsertBookChatRating,
}))

vi.mock('../../features/auth', () => ({
  useAuthenticatedUser: () => ({ id: profileId }),
}))

vi.mock('../../shared/api/supabaseClient', () => ({ createSupabaseClient: vi.fn() }))

/** 관리 화면 테스트에서 쓰는 책 대화방 응답을 생성한다. */
function createManagedBookChat() {
  return {
    id: bookChatId,
    name: '함께 읽는 책',
    roomId,
    status: 'reading',
    thumbnailUrl: null,
    title: '함께 읽는 책',
  }
}

getManagedBookChat.mockResolvedValue(createManagedBookChat())

describe('BookChatManagementPage', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    getBookChatRatings.mockResolvedValue([])
    getManagedBookChat.mockResolvedValue(createManagedBookChat())
    upsertBookChatRating.mockResolvedValue(undefined)
  })

  it('opens the rating sheet before saving my rating', async () => {
    renderBookChatManagementPage()

    expect(await screen.findByRole('heading', { name: '내 별점' })).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: '별점 남기기' }))

    expect(upsertBookChatRating).not.toHaveBeenCalled()
    expect(await screen.findByRole('dialog', { name: '별점 남기기' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '4점' }))
    fireEvent.change(screen.getByLabelText('총평 (선택)'), {
      target: { value: '다시 읽고 싶은 책이에요.' },
    })
    fireEvent.click(screen.getByRole('button', { name: '별점 저장' }))

    await waitFor(() =>
      expect(upsertBookChatRating).toHaveBeenCalledWith(undefined, {
        bookChatId,
        rating: 4,
        review: '다시 읽고 싶은 책이에요.',
      }),
    )
  })

  it('keeps my rating visible immediately even before a later refresh', async () => {
    renderBookChatManagementPage()

    fireEvent.click(await screen.findByRole('button', { name: '별점 남기기' }))
    fireEvent.click(screen.getByRole('button', { name: '5점' }))
    fireEvent.click(screen.getByRole('button', { name: '별점 저장' }))

    expect(await screen.findByRole('img', { name: '별점 5점' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '수정하기' })).toBeInTheDocument()
  })

  it('closes the rating sheet even when background refresh fails', async () => {
    const { queryClient } = renderBookChatManagementPage()
    vi.spyOn(queryClient, 'invalidateQueries').mockRejectedValue(
      new Error('background refresh failed'),
    )

    fireEvent.click(await screen.findByRole('button', { name: '별점 남기기' }))
    fireEvent.click(screen.getByRole('button', { name: '3점' }))
    fireEvent.click(screen.getByRole('button', { name: '별점 저장' }))

    await waitFor(() => expect(upsertBookChatRating).toHaveBeenCalled())
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: '별점 남기기' })).not.toBeInTheDocument(),
    )
  })

  it('does not expose archive controls to a reading member', async () => {
    renderBookChatManagementPage()

    expect(await screen.findByRole('button', { name: '별점 남기기' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '아카이브로 이동' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '다시 읽는 중으로' })).not.toBeInTheDocument()
  })

  it('shows my saved rating and opens saved values for editing', async () => {
    getBookChatRatings.mockResolvedValueOnce([
      {
        avatarPath: null,
        displayName: '민규',
        isMe: true,
        profileId,
        rating: 3,
        review: '친구와 이야기하기 좋은 책이에요.',
        updatedAt: '2026-07-19T00:00:00.000Z',
      },
    ])
    renderBookChatManagementPage()

    expect(await screen.findByRole('img', { name: '별점 3점' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '별점 남기기' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '수정하기' }))

    expect(screen.getByRole('button', { name: '3점' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('총평 (선택)')).toHaveValue('친구와 이야기하기 좋은 책이에요.')
    expect(screen.getByRole('button', { name: '별점 수정' })).toBeInTheDocument()
  })
})

/** 책 대화방 관리 화면을 서버 상태와 라우터를 포함해 렌더링한다. */
function renderBookChatManagementPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const renderResult = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/rooms/${roomId}/books/${bookChatId}/manage`]}>
        <Routes>
          <Route
            element={<BookChatManagementPage />}
            path="/rooms/:roomId/books/:bookChatId/manage"
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )

  return { queryClient, renderResult }
}
