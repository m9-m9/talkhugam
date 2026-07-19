import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MyReadingBooksPage } from './MyReadingBooksPage'

const {
  getMyBookChatCompletionIds,
  getMyCompletedBooks,
  getMyReadingBooks,
  getMyReadingProgresses,
  upsertReadingProgress,
  upsertBookChatCompletion,
} = vi.hoisted(() => ({
  getMyBookChatCompletionIds: vi.fn().mockResolvedValue(['00000000-0000-0000-0000-000000000101']),
  getMyCompletedBooks: vi.fn().mockResolvedValue([
    {
      authors: ['기시미 이치로'],
      bookChatId: '00000000-0000-0000-0000-000000000101',
      completedAt: '2026-07-18T01:00:00+00:00',
      rating: 4,
      review: '나를 돌아보게 한 책이에요.',
      roomId: '00000000-0000-0000-0000-000000000201',
      thumbnailUrl: null,
      title: '미움받을 용기',
    },
  ]),
  getMyReadingBooks: vi.fn().mockResolvedValue([
    {
      authors: ['기시미 이치로'],
      bookChatId: '00000000-0000-0000-0000-000000000101',
      isCompleted: true,
      roomId: '00000000-0000-0000-0000-000000000201',
      roomName: '금요일 아침 책방',
      thumbnailUrl: null,
      title: '미움받을 용기',
    },
    {
      authors: ['양귀자'],
      bookChatId: '00000000-0000-0000-0000-000000000102',
      isCompleted: false,
      roomId: '00000000-0000-0000-0000-000000000202',
      roomName: '토요일 저녁 책방',
      thumbnailUrl: null,
      title: '모순',
    },
  ]),
  getMyReadingProgresses: vi.fn().mockResolvedValue([
    {
      bookChatId: '00000000-0000-0000-0000-000000000102',
      currentPage: 146,
      totalPages: 298,
      updatedAt: '2026-07-19T01:00:00+00:00',
    },
  ]),
  upsertReadingProgress: vi.fn().mockResolvedValue(undefined),
  upsertBookChatCompletion: vi.fn().mockResolvedValue(undefined),
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
    byChat: (bookChatId: string) => ['book-completions', bookChatId],
    myBookChatIds: (profileId: string) => ['my-completion-book-chat-ids', profileId],
    myBooks: (profileId: string) => ['my-completed-books', profileId],
  },
  getMyBookChatCompletionIds,
  getMyCompletedBooks,
  upsertBookChatCompletion,
}))

vi.mock('../../entities/reading-progress', () => ({
  calculateReadingProgressPercent: (currentPage: number, totalPages: number) =>
    Math.round((currentPage / totalPages) * 100),
  getMyReadingProgresses,
  readingProgressKeys: { byProfile: (profileId: string) => ['reading-progresses', profileId] },
  upsertReadingProgress,
}))

vi.mock('../../features/auth', () => ({
  useAuthenticatedUser: () => ({ id: '00000000-0000-0000-0000-000000000001' }),
}))

vi.mock('../../shared/api/supabaseClient', () => ({ createSupabaseClient: vi.fn() }))

describe('MyReadingBooksPage', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('lists every joined room reading book and shows my personal completion state', async () => {
    renderMyReadingBooksPage()

    expect(await screen.findByText('금요일 아침 책방')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '읽고 있는 책' })).toBeInTheDocument()
    expect(screen.getByText('토요일 저녁 책방')).toBeInTheDocument()
    expect(screen.getByText('완독')).toBeInTheDocument()
    expect(screen.getByText('별점 4점')).toBeInTheDocument()
    expect(screen.getByText('총평 작성함')).toBeInTheDocument()
    expect(screen.getByText('146 / 298쪽')).toBeInTheDocument()
    expect(screen.getByText('49%')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '미움받을 용기 책 대화로 이동' })).toHaveAttribute(
      'href',
      '/rooms/00000000-0000-0000-0000-000000000201/books/00000000-0000-0000-0000-000000000101',
    )
  })

  it('opens a progress sheet and saves the personal page record', async () => {
    renderMyReadingBooksPage()

    fireEvent.click(await screen.findByRole('button', { name: '모순 진행률 기록하기' }))
    expect(screen.getByRole('dialog', { name: '독서 진행률 기록' })).toBeInTheDocument()
    fireEvent.change(screen.getByRole('spinbutton', { name: '현재 읽은 페이지' }), {
      target: { value: '150' },
    })
    fireEvent.click(screen.getByRole('button', { name: '진행률 저장' }))

    await waitFor(() =>
      expect(upsertReadingProgress).toHaveBeenCalledWith(undefined, {
        bookChatId: '00000000-0000-0000-0000-000000000102',
        currentPage: 150,
        totalPages: 298,
      }),
    )
  })

  it('opens a completion record sheet from an unfinished book card', async () => {
    renderMyReadingBooksPage()

    fireEvent.click(await screen.findByRole('button', { name: '모순 완독하기' }))

    expect(screen.getByRole('dialog', { name: '완독 기록' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '완독 기록 저장' })).toBeInTheDocument()
  })

  it('shows a recoverable message when saving personal progress fails', async () => {
    upsertReadingProgress.mockRejectedValueOnce(new Error('RPC failed'))
    renderMyReadingBooksPage()

    fireEvent.click(await screen.findByRole('button', { name: '모순 진행률 기록하기' }))
    fireEvent.click(screen.getByRole('button', { name: '진행률 저장' }))

    expect(
      await screen.findByText('진행률을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.'),
    ).toBeInTheDocument()
  })

  it('opens a prefilled completion record sheet from a completed book card', async () => {
    renderMyReadingBooksPage()

    fireEvent.click(await screen.findByRole('button', { name: '미움받을 용기 기록 수정' }))

    expect(screen.getByRole('dialog', { name: '완독 기록' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '4점', pressed: true })).toBeInTheDocument()
    expect(screen.getByDisplayValue('나를 돌아보게 한 책이에요.')).toBeInTheDocument()
  })

  it('saves the rating and review entered from an unfinished book card', async () => {
    renderMyReadingBooksPage()

    fireEvent.click(await screen.findByRole('button', { name: '모순 완독하기' }))
    fireEvent.click(screen.getByRole('button', { name: '5점' }))
    fireEvent.change(screen.getByRole('textbox', { name: '총평 (선택)' }), {
      target: { value: '다시 읽고 싶은 문장이 많아요.' },
    })
    fireEvent.click(screen.getByRole('button', { name: '완독 기록 저장' }))

    await waitFor(() =>
      expect(upsertBookChatCompletion).toHaveBeenCalledWith(undefined, {
        bookChatId: '00000000-0000-0000-0000-000000000102',
        rating: 5,
        review: '다시 읽고 싶은 문장이 많아요.',
      }),
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
