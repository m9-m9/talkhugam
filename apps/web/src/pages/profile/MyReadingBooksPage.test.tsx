import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MyReadingBooksPage } from './MyReadingBooksPage'

const profileId = '3b0f6c1e-8d2a-4f5b-9c7e-2a1d4e6f8a01'
const ratedBookChatId = '3b0f6c1e-8d2a-4f5b-9c7e-2a1d4e6f8a02'
const unratedBookChatId = '3b0f6c1e-8d2a-4f5b-9c7e-2a1d4e6f8a03'
const fridayRoomId = '3b0f6c1e-8d2a-4f5b-9c7e-2a1d4e6f8a04'
const saturdayRoomId = '3b0f6c1e-8d2a-4f5b-9c7e-2a1d4e6f8a05'

const { getMyRatedBooks, getMyReadingBooks, upsertBookChatRating } = vi.hoisted(() => ({
  getMyRatedBooks: vi.fn(),
  getMyReadingBooks: vi.fn(),
  upsertBookChatRating: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../entities/book-chat', () => ({
  bookChatKeys: {
    myReading: (targetProfileId: string) => ['my-reading-books', targetProfileId],
  },
  getMyReadingBooks,
}))

vi.mock('../../entities/book-rating', () => ({
  bookRatingKeys: {
    byChat: (bookChatId: string) => ['book-ratings', bookChatId],
    myBooks: (targetProfileId: string) => ['my-rated-books', targetProfileId],
  },
  getMyRatedBooks,
  upsertBookChatRating,
}))

vi.mock('../../features/auth', () => ({
  useAuthenticatedUser: () => ({ id: profileId }),
}))

vi.mock('../../shared/api/supabaseClient', () => ({ createSupabaseClient: vi.fn() }))

/** 내 책 화면 테스트에서 쓰는 참여 책방 책 목록 응답을 생성한다. */
function createReadingBooks() {
  return [
    {
      authors: ['기시미 이치로'],
      bookChatId: ratedBookChatId,
      roomId: fridayRoomId,
      roomName: '금요일 아침 책방',
      thumbnailUrl: null,
      title: '미움받을 용기',
    },
    {
      authors: ['양귀자'],
      bookChatId: unratedBookChatId,
      roomId: saturdayRoomId,
      roomName: '토요일 저녁 책방',
      thumbnailUrl: null,
      title: '모순',
    },
  ]
}

/** 내 책 화면 테스트에서 쓰는 내 별점 도서 응답을 생성한다. */
function createRatedBooks() {
  return [
    {
      authors: ['기시미 이치로'],
      bookChatId: ratedBookChatId,
      rating: 4,
      review: '나를 돌아보게 한 책이에요.',
      roomId: fridayRoomId,
      thumbnailUrl: null,
      title: '미움받을 용기',
      updatedAt: '2026-07-18T01:00:00+00:00',
    },
  ]
}

describe('MyReadingBooksPage', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('lists every joined room book with my rating', async () => {
    getMyReadingBooks.mockResolvedValue(createReadingBooks())
    getMyRatedBooks.mockResolvedValue(createRatedBooks())
    renderMyReadingBooksPage()

    expect(await screen.findByText('금요일 아침 책방')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '내 책' })).toBeInTheDocument()
    expect(screen.getByText('토요일 저녁 책방')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '별점 4점' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '모순 별점 남기기' })).toBeInTheDocument()
    expect(screen.queryByRole('spinbutton')).toBeNull()
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.getByRole('link', { name: '미움받을 용기 책 대화로 이동' })).toHaveAttribute(
      'href',
      `/rooms/${fridayRoomId}/books/${ratedBookChatId}`,
    )
    expect(getMyReadingBooks).toHaveBeenCalledWith(undefined, profileId)
  })

  it('saves the rating and review entered from an unrated book card', async () => {
    getMyReadingBooks.mockResolvedValue(createReadingBooks())
    getMyRatedBooks.mockResolvedValueOnce(createRatedBooks()).mockResolvedValueOnce([
      ...createRatedBooks(),
      {
        authors: ['양귀자'],
        bookChatId: unratedBookChatId,
        rating: 5,
        review: '다시 읽고 싶은 문장이 많아요.',
        roomId: saturdayRoomId,
        thumbnailUrl: null,
        title: '모순',
        updatedAt: '2026-07-19T01:00:00+00:00',
      },
    ])
    renderMyReadingBooksPage()

    fireEvent.click(await screen.findByRole('button', { name: '모순 별점 남기기' }))
    const sheet = screen.getByRole('dialog', { name: '별점 남기기' })
    fireEvent.click(within(sheet).getByRole('button', { name: '5점' }))
    fireEvent.change(within(sheet).getByRole('textbox', { name: '총평 (선택)' }), {
      target: { value: '다시 읽고 싶은 문장이 많아요.' },
    })
    fireEvent.click(within(sheet).getByRole('button', { name: '별점 저장' }))

    await waitFor(() =>
      expect(upsertBookChatRating).toHaveBeenCalledWith(undefined, {
        bookChatId: unratedBookChatId,
        rating: 5,
        review: '다시 읽고 싶은 문장이 많아요.',
      }),
    )
    expect(await screen.findByRole('img', { name: '별점 5점' })).toBeInTheDocument()
  })

  it('opens my saved rating prefilled from a rated book card', async () => {
    getMyReadingBooks.mockResolvedValue(createReadingBooks())
    getMyRatedBooks.mockResolvedValue(createRatedBooks())
    renderMyReadingBooksPage()

    fireEvent.click(await screen.findByRole('button', { name: '미움받을 용기 별점 수정하기' }))

    expect(screen.getByRole('dialog', { name: '별점 남기기' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '4점', pressed: true })).toBeInTheDocument()
    expect(screen.getByDisplayValue('나를 돌아보게 한 책이에요.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '별점 수정' })).toBeInTheDocument()
  })

  it('shows a recoverable message when saving my rating fails', async () => {
    getMyReadingBooks.mockResolvedValue(createReadingBooks())
    getMyRatedBooks.mockResolvedValue(createRatedBooks())
    upsertBookChatRating.mockRejectedValueOnce(new Error('RPC failed'))
    renderMyReadingBooksPage()

    fireEvent.click(await screen.findByRole('button', { name: '모순 별점 남기기' }))
    fireEvent.click(screen.getByRole('button', { name: '3점' }))
    fireEvent.click(screen.getByRole('button', { name: '별점 저장' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '별점을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.',
    )
  })
})

/** 내 책 화면을 라우터와 서버 상태 Provider를 포함해 렌더링한다. */
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
