import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { MyReadingBooksPage } from './MyReadingBooksPage'

const { getMyBookChatCompletionIds, getMyReadingBooks } = vi.hoisted(() => ({
  getMyBookChatCompletionIds: vi.fn().mockResolvedValue(['00000000-0000-0000-0000-000000000101']),
  getMyReadingBooks: vi.fn().mockResolvedValue([
    {
      authors: ['기시미 이치로'],
      bookChatId: '00000000-0000-0000-0000-000000000101',
      isCompleted: true,
      roomId: '00000000-0000-0000-0000-000000000201',
      roomName: '금요일 아침 독서방',
      thumbnailUrl: null,
      title: '미움받을 용기',
    },
    {
      authors: ['양귀자'],
      bookChatId: '00000000-0000-0000-0000-000000000102',
      isCompleted: false,
      roomId: '00000000-0000-0000-0000-000000000202',
      roomName: '토요일 저녁 독서방',
      thumbnailUrl: null,
      title: '모순',
    },
  ]),
}))

vi.mock('../../entities/book-chat', () => ({
  bookChatKeys: {
    myReading: (profileId: string, completedBookChatIds: readonly string[]) => [
      'my-reading-books',
      profileId,
      ...completedBookChatIds,
    ],
  },
  getMyReadingBooks,
}))

vi.mock('../../entities/book-completion', () => ({
  bookCompletionKeys: {
    myBookChatIds: (profileId: string) => ['my-completion-book-chat-ids', profileId],
  },
  getMyBookChatCompletionIds,
}))

vi.mock('../../features/auth', () => ({
  useAuthenticatedUser: () => ({ id: '00000000-0000-0000-0000-000000000001' }),
}))

vi.mock('../../shared/api/supabaseClient', () => ({ createSupabaseClient: vi.fn() }))

describe('MyReadingBooksPage', () => {
  it('lists every joined room reading book and shows my personal completion state', async () => {
    renderMyReadingBooksPage()

    expect(await screen.findByText('금요일 아침 독서방')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '함께 읽고 있는 책' })).toBeInTheDocument()
    expect(screen.getByText('토요일 저녁 독서방')).toBeInTheDocument()
    expect(screen.getByText('완독')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '미움받을 용기 책 대화로 이동' })).toHaveAttribute(
      'href',
      '/rooms/00000000-0000-0000-0000-000000000201/books/00000000-0000-0000-0000-000000000101',
    )
  })
})

/** 읽고 있는 책 화면을 라우터와 서버 상태 Provider를 포함해 렌더링한다. */
function renderMyReadingBooksPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/profile/books']}>
        <Routes>
          <Route path="/profile/books" element={<MyReadingBooksPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
