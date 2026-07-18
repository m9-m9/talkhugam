import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { BookSearchItem } from '../../entities/book-chat'
import { BookSearchPage } from './BookSearchPage'

const { searchBooks } = vi.hoisted(() => ({ searchBooks: vi.fn() }))

vi.mock('../../entities/book-chat', () => ({
  bookChatKeys: { byRoom: (roomId: string) => ['book-chats', roomId] },
  createBookChat: vi.fn(),
  searchBooks,
}))

vi.mock('../../shared/api/supabaseClient', () => ({ createSupabaseClient: vi.fn() }))

describe('BookSearchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('waits 300ms after typing before searching', async () => {
    searchBooks.mockResolvedValue([])
    renderBookSearchPage()

    fireEvent.change(screen.getByPlaceholderText('책 제목이나 저자'), {
      target: { value: '미움' },
    })

    await act(() => vi.advanceTimersByTimeAsync(299))
    expect(searchBooks).not.toHaveBeenCalled()

    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(searchBooks).toHaveBeenCalledOnce()
  })

  it('starts the current valid search when Enter is pressed in the search input', async () => {
    searchBooks.mockResolvedValue([])
    renderBookSearchPage()

    const input = screen.getByPlaceholderText('책 제목이나 저자')
    fireEvent.change(input, { target: { value: '미움' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await act(() => vi.advanceTimersByTimeAsync(300))
    expect(searchBooks).toHaveBeenCalledOnce()
  })

  it('shows the book loader only after a slow book search has waited 400ms', async () => {
    searchBooks.mockReturnValue(new Promise(() => undefined))
    renderBookSearchPage()

    fireEvent.change(screen.getByPlaceholderText('책 제목이나 저자'), {
      target: { value: '미움' },
    })
    await act(() => vi.advanceTimersByTimeAsync(300))
    await act(() => vi.advanceTimersByTimeAsync(399))

    expect(screen.queryByRole('status', { name: '책을 찾고 있어요…' })).not.toBeInTheDocument()

    await act(() => vi.advanceTimersByTimeAsync(1))

    const status = screen.getByRole('status', { name: '책을 찾고 있어요…' })
    expect(status.querySelector('.talkhugam-book-loader')).toBeInTheDocument()
  })

  it('does not let an older response replace the latest search result', async () => {
    const firstSearch = deferred<BookSearchItem[]>()
    const secondSearch = deferred<BookSearchItem[]>()
    searchBooks.mockReturnValueOnce(firstSearch.promise).mockReturnValueOnce(secondSearch.promise)
    renderBookSearchPage()

    const input = screen.getByPlaceholderText('책 제목이나 저자')
    fireEvent.change(input, { target: { value: '미움받을' } })
    await act(() => vi.advanceTimersByTimeAsync(300))
    fireEvent.change(input, { target: { value: '용기' } })
    await act(() => vi.advanceTimersByTimeAsync(300))

    await act(async () => secondSearch.resolve([createBook('최신 결과')]))
    expect(screen.getByText('최신 결과')).toBeInTheDocument()

    await act(async () => firstSearch.resolve([createBook('오래된 결과')]))
    expect(screen.queryByText('오래된 결과')).not.toBeInTheDocument()
    expect(screen.getByText('최신 결과')).toBeInTheDocument()
  })

  it('keeps the current results visible while a newer search is pending', async () => {
    const secondSearch = deferred<BookSearchItem[]>()
    searchBooks.mockResolvedValueOnce([createBook('처음 결과')]).mockReturnValueOnce(secondSearch.promise)
    renderBookSearchPage()

    const input = screen.getByPlaceholderText('책 제목이나 저자')
    fireEvent.change(input, { target: { value: '미움받을' } })
    await act(() => vi.advanceTimersByTimeAsync(300))
    await act(async () => undefined)
    expect(screen.getByText('처음 결과')).toBeInTheDocument()

    fireEvent.change(input, { target: { value: '용기' } })
    await act(() => vi.advanceTimersByTimeAsync(700))

    expect(screen.getByText('처음 결과')).toBeInTheDocument()
    expect(screen.getByRole('status', { name: '책을 찾고 있어요…' })).toBeInTheDocument()
  })
})

function renderBookSearchPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/rooms/room-1/books/new']}>
        <Routes>
          <Route path="/rooms/:roomId/books/new" element={<BookSearchPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function createBook(title: string): BookSearchItem {
  return {
    authors: ['기시미 이치로'],
    externalUrl: null,
    isbn10: null,
    isbn13: title,
    publishedAt: null,
    publisher: null,
    source: 'kakao',
    thumbnailUrl: null,
    title,
  }
}

function deferred<T>() {
  let resolvePromise: (value: T) => void = () => undefined
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve
  })
  return { promise, resolve: resolvePromise }
}
