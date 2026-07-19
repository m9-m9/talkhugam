import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BookChatManagementPage } from './BookChatManagementPage'

const { getBookChatCompletions, getManagedBookChat, upsertBookChatCompletion } = vi.hoisted(() => ({
  getBookChatCompletions: vi.fn().mockResolvedValue([]),
  getManagedBookChat: vi.fn().mockResolvedValue({
    id: '00000000-0000-0000-0000-000000000101',
    name: '함께 읽는 책',
    roomId: '00000000-0000-0000-0000-000000000102',
    status: 'reading',
    thumbnailUrl: null,
    title: '함께 읽는 책',
  }),
  upsertBookChatCompletion: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../entities/book-chat', () => ({
  bookChatKeys: {
    byRoom: (roomId: string) => ['book-chats', roomId],
    myReading: (profileId: string) => ['my-reading-books', profileId],
  },
  deleteManagedBookChat: vi.fn(),
  getManagedBookChat,
  updateBookChatStatus: vi.fn(),
}))

vi.mock('../../entities/reading-progress', () => ({
  readingProgressKeys: { byProfile: (profileId: string) => ['reading-progresses', profileId] },
}))

vi.mock('../../entities/book-completion', () => ({
  bookCompletionKeys: {
    byChat: (bookChatId: string) => ['book-completions', bookChatId],
    myBookChatIds: (profileId: string) => ['my-completion-book-chat-ids', profileId],
    myBooks: (profileId: string) => ['my-completed-books', profileId],
  },
  getBookChatCompletions,
  upsertBookChatCompletion,
}))

vi.mock('../../features/auth', () => ({
  useAuthenticatedUser: () => ({ id: '00000000-0000-0000-0000-000000000001' }),
}))

vi.mock('../../shared/api/supabaseClient', () => ({ createSupabaseClient: vi.fn() }))

describe('BookChatManagementPage', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    getBookChatCompletions.mockResolvedValue([])
    getManagedBookChat.mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000101',
      name: '함께 읽는 책',
      roomId: '00000000-0000-0000-0000-000000000102',
      status: 'reading',
      thumbnailUrl: null,
      title: '함께 읽는 책',
    })
    upsertBookChatCompletion.mockResolvedValue(undefined)
  })

  it('opens a review sheet before creating a personal completion record', async () => {
    renderBookChatManagementPage()

    fireEvent.click(await screen.findByRole('button', { name: '완독하기' }))

    expect(upsertBookChatCompletion).not.toHaveBeenCalled()
    expect(await screen.findByRole('dialog', { name: '완독 기록' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '4점' }))
    fireEvent.change(screen.getByLabelText('총평 (선택)'), {
      target: { value: '다시 읽고 싶은 책이에요.' },
    })
    fireEvent.click(screen.getByRole('button', { name: '완독 기록 저장' }))

    await waitFor(() =>
      expect(upsertBookChatCompletion).toHaveBeenCalledWith(undefined, {
        bookChatId: '00000000-0000-0000-0000-000000000101',
        rating: 4,
        review: '다시 읽고 싶은 책이에요.',
      }),
    )
  })

  it('does not expose archive controls to a reading member', async () => {
    renderBookChatManagementPage()

    expect(await screen.findByRole('button', { name: '완독하기' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '아카이브로 이동' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '다시 읽는 중으로' })).not.toBeInTheDocument()
  })

  it('shows a personal completion marker and opens saved values for editing', async () => {
    getBookChatCompletions.mockResolvedValueOnce([
      {
        completedAt: '2026-07-19T00:00:00.000Z',
        displayName: '민규',
        isMe: true,
        profileId: '00000000-0000-0000-0000-000000000001',
        rating: 3,
        review: '친구와 이야기하기 좋은 책이에요.',
      },
    ])
    renderBookChatManagementPage()

    expect(await screen.findByText('내 완독')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '수정하기' }))

    expect(screen.getByRole('button', { name: '3점' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('총평 (선택)')).toHaveValue('친구와 이야기하기 좋은 책이에요.')
    expect(screen.getByRole('button', { name: '완독 기록 수정' })).toBeInTheDocument()
  })
})

/** 책 대화방 관리 화면을 서버 상태와 라우터를 포함해 렌더링한다. */
function renderBookChatManagementPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={[
          '/rooms/00000000-0000-0000-0000-000000000102/books/00000000-0000-0000-0000-000000000101/manage',
        ]}
      >
        <Routes>
          <Route
            element={<BookChatManagementPage />}
            path="/rooms/:roomId/books/:bookChatId/manage"
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
