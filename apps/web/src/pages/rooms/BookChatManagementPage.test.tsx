import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { BookChatManagementPage } from './BookChatManagementPage'

const { getManagedBookChat, upsertBookChatCompletion } = vi.hoisted(() => ({
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
  bookChatKeys: { byRoom: (roomId: string) => ['book-chats', roomId] },
  deleteManagedBookChat: vi.fn(),
  getManagedBookChat,
  updateBookChatStatus: vi.fn(),
}))

vi.mock('../../entities/book-completion', () => ({
  bookCompletionKeys: {
    myBookChatIds: (profileId: string) => ['my-completion-book-chat-ids', profileId],
    myBooks: (profileId: string) => ['my-completed-books', profileId],
  },
  upsertBookChatCompletion,
}))

vi.mock('../../features/auth', () => ({
  useAuthenticatedUser: () => ({ id: '00000000-0000-0000-0000-000000000001' }),
}))

vi.mock('../../shared/api/supabaseClient', () => ({ createSupabaseClient: vi.fn() }))

describe('BookChatManagementPage', () => {
  it('records the current member completion instead of changing the shared book status', async () => {
    renderBookChatManagementPage()

    fireEvent.click(await screen.findByRole('button', { name: '내 완독으로 기록' }))

    await waitFor(() =>
      expect(upsertBookChatCompletion).toHaveBeenCalledWith(undefined, {
        bookChatId: '00000000-0000-0000-0000-000000000101',
        rating: null,
        review: null,
      }),
    )
  })

  it('does not expose archive controls to a reading member', async () => {
    renderBookChatManagementPage()

    expect(await screen.findByRole('button', { name: '내 완독으로 기록' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '아카이브로 이동' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '다시 읽는 중으로' })).not.toBeInTheDocument()
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
