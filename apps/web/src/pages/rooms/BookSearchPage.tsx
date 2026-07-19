import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'

import {
  bookChatKeys,
  createBookChat,
  searchBooks,
  type BookSearchItem,
} from '../../entities/book-chat'
import {
  bookBestsellerKeys,
  getBookBestsellers,
  mapBestsellerToBookSearchItem,
} from '../../entities/bestseller'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { trackAnalyticsEvent } from '../../shared/analytics'
import { AppHeader } from '../../shared/ui/AppHeader'
import { BookCover } from '../../shared/ui/BookCover'
import { LoadingSpinner } from '../../shared/ui/LoadingSpinner'

const querySchema = z
  .string()
  .trim()
  .min(2, '책 제목이나 저자를 두 글자 이상 입력해 주세요.')
  .max(100)

const bookSearchDebounceMs = 300
const bookLoaderDelayMs = 400

/** 책 검색 페이지 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
export function BookSearchPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { roomId } = useParams()
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<BookSearchItem[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isBookLoaderVisible, setIsBookLoaderVisible] = useState(false)
  const [searchVersion, setSearchVersion] = useState(0)
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null)
  const bestsellersQuery = useQuery({
    queryFn: () => getBookBestsellers(createSupabaseClient()),
    queryKey: bookBestsellerKeys.current,
    staleTime: 10 * 60 * 1_000,
  })

  useEffect(() => {
    const parsed = querySchema.safeParse(query)
    if (!parsed.success) return

    let wasCancelled = false
    let loaderTimeoutId: number | null = null
    const timeoutId = window.setTimeout(() => {
      loaderTimeoutId = window.setTimeout(() => {
        if (!wasCancelled) setIsBookLoaderVisible(true)
      }, bookLoaderDelayMs)
      void searchBooksForQuery(
        parsed.data,
        () => wasCancelled,
        setErrorMessage,
        setIsBookLoaderVisible,
        setIsSearching,
        setItems,
      )
    }, bookSearchDebounceMs)

    return () => {
      wasCancelled = true
      window.clearTimeout(timeoutId)
      if (loaderTimeoutId !== null) window.clearTimeout(loaderTimeoutId)
    }
  }, [query, searchVersion])

  /** 검색어를 검증해 검색 대기 상태를 갱신하고, 유효하지 않은 기존 결과만 비운다. */
  function handleQueryChange(value: string) {
    const isValidQuery = querySchema.safeParse(value).success
    setQuery(value)
    setIsBookLoaderVisible(false)
    setIsSearching(isValidQuery)
    if (!isValidQuery) {
      setItems([])
    }
    setErrorMessage(value.trim().length > 100 ? '검색어는 100자 이하로 입력해 주세요.' : null)
  }

  /** 현재 유효한 검색어의 debounce 주기를 새로 시작해 책 검색을 다시 요청한다. */
  function handleSearch() {
    const parsed = querySchema.safeParse(query)
    if (!parsed.success) {
      setErrorMessage(parsed.error.issues[0]?.message ?? '검색어를 확인해 주세요.')
      return
    }

    setErrorMessage(null)
    setIsBookLoaderVisible(false)
    setIsSearching(true)
    setSearchVersion((version) => version + 1)
  }

  /** 책 검색창에서 Enter를 누르면 현재 검색어로 다시 조회한다. */
  function handleSearchInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    handleSearch()
  }

  /** 선택한 책으로 책방의 책 대화를 만들고, 성공하면 책방 상세로 이동한다. */
  async function handleSelectBook(book: BookSearchItem) {
    if (!roomId) return
    setSelectedBookId(book.title)
    try {
      await createBookChat(createSupabaseClient(), roomId, book)
      await queryClient.invalidateQueries({ queryKey: bookChatKeys.byRoom(roomId) })
      trackAnalyticsEvent('book_chat_created')
      void navigate(`/rooms/${roomId}`, { replace: true })
    } catch {
      setErrorMessage('이 책을 추가하지 못했어요. 잠시 후 다시 시도해 주세요.')
      setSelectedBookId(null)
    }
  }

  return (
    <main className="app-page bg-surface px-4 pb-8">
      <AppHeader onBack={() => void navigate(-1)} title="책 검색" />
      <header className="mt-8">
        <h1 className="text-ink text-xl font-bold">무슨 책으로 이야기 나눌까요?</h1>
        <p className="text-ink-subtle mt-2 text-sm">책 제목이나 저자를 검색해 보세요.</p>
      </header>
      <div className="mt-8 flex gap-2">
        <input
          className="border-ink/10 focus:border-primary min-h-12 min-w-0 flex-1 rounded-md border bg-white px-4 text-sm outline-none"
          onChange={(event) => handleQueryChange(event.target.value)}
          onKeyDown={handleSearchInputKeyDown}
          placeholder="책 제목이나 저자"
          value={query}
        />
        <button
          className="bg-primary min-h-12 rounded-md px-4 text-sm font-semibold text-white"
          onClick={handleSearch}
          type="button"
        >
          검색
        </button>
      </div>
      {errorMessage ? (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <BookResults
        bestsellerItems={(bestsellersQuery.data?.items ?? [])
          .slice(0, 10)
          .map(mapBestsellerToBookSearchItem)}
        hasQuery={query.trim().length >= 2}
        isBookLoaderVisible={isBookLoaderVisible}
        isCreatingId={selectedBookId}
        isSearching={isSearching}
        items={items}
        onSelect={handleSelectBook}
      />
    </main>
  )
}

/** 책 검색 결과 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
function BookResults({
  bestsellerItems,
  hasQuery,
  isBookLoaderVisible,
  isCreatingId,
  isSearching,
  items,
  onSelect,
}: {
  bestsellerItems: BookSearchItem[]
  hasQuery: boolean
  isBookLoaderVisible: boolean
  isCreatingId: string | null
  isSearching: boolean
  items: BookSearchItem[]
  onSelect: (book: BookSearchItem) => void
}) {
  const bookLoader = isBookLoaderVisible ? (
    <div className="mt-6">
      <LoadingSpinner label="책을 찾고 있어요…" size="sm" variant="book" />
    </div>
  ) : null

  if (items.length === 0 && isSearching) return bookLoader
  if (items.length === 0 && hasQuery)
    return <p className="text-ink-subtle mt-12 text-center text-sm">검색 결과가 없어요.</p>

  if (items.length === 0)
    return (
      <BookRecommendationList
        isCreatingId={isCreatingId}
        items={bestsellerItems}
        onSelect={onSelect}
      />
    )
  return (
    <>
      {bookLoader}
      <ul className="mt-6 space-y-3">
        {items.map((book) => (
          <li key={`${book.title}-${book.isbn13 ?? book.isbn10 ?? book.externalUrl ?? ''}`}>
            <BookResultButton
              book={book}
              isCreating={isCreatingId === book.title}
              isDisabled={isCreatingId !== null}
              onSelect={onSelect}
            />
          </li>
        ))}
      </ul>
    </>
  )
}

/** 아직 검색어가 없을 때 알라딘 베스트셀러를 최대 열 권까지 세로 목록으로 안내한다. */
function BookRecommendationList({
  isCreatingId,
  items,
  onSelect,
}: {
  isCreatingId: string | null
  items: BookSearchItem[]
  onSelect: (book: BookSearchItem) => void
}) {
  if (items.length === 0)
    return (
      <p className="text-ink-subtle mt-12 text-center text-sm">
        책 제목이나 저자를 두 글자 이상 입력해 주세요.
      </p>
    )

  return (
    <section aria-labelledby="recommended-books-heading" className="mt-8">
      <div className="mb-3">
        <h2 className="text-ink text-base font-bold" id="recommended-books-heading">
          지금 많이 읽는 책
        </h2>
        <p className="text-ink-subtle mt-1 text-xs">
          마음에 드는 책을 골라 책 대화를 시작해 보세요.
        </p>
      </div>
      <ul className="space-y-3">
        {items.map((book) => (
          <li key={`${book.title}-${book.isbn13 ?? book.externalUrl ?? ''}`}>
            <BookResultButton
              book={book}
              isCreating={isCreatingId === book.title}
              isDisabled={isCreatingId !== null}
              onSelect={onSelect}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}

/** 검색 또는 추천 목록의 한 권을 선택 가능한 공통 카드로 렌더링한다. */
function BookResultButton({
  book,
  isCreating,
  isDisabled,
  onSelect,
}: {
  book: BookSearchItem
  isCreating: boolean
  isDisabled: boolean
  onSelect: (book: BookSearchItem) => void
}) {
  return (
    <button
      className="border-ink/10 flex min-h-24 w-full items-center gap-3 rounded-lg border bg-white p-4 text-left"
      disabled={isDisabled}
      onClick={() => void onSelect(book)}
      type="button"
    >
      <BookCover alt={`${book.title} 표지`} thumbnailUrl={book.thumbnailUrl} />
      <span className="min-w-0">
        <span className="text-ink block text-sm font-bold">{book.title}</span>
        <span className="text-ink-subtle mt-1 block text-xs">
          {book.authors.join(', ')}
          {book.publisher ? ` · ${book.publisher}` : ''}
        </span>
        {isCreating ? (
          <div className="mt-2">
            <LoadingSpinner label="책 대화를 만들고 있어요…" size="xs" />
          </div>
        ) : null}
      </span>
    </button>
  )
}

/** 유효한 검색어를 조회하고, 취소되지 않은 최신 요청의 결과와 로딩 상태만 갱신한다. */
async function searchBooksForQuery(
  query: string,
  isCancelled: () => boolean,
  setErrorMessage: (message: string | null) => void,
  setIsBookLoaderVisible: (isVisible: boolean) => void,
  setIsSearching: (isSearching: boolean) => void,
  setItems: (items: BookSearchItem[]) => void,
) {
  setErrorMessage(null)
  setIsSearching(true)

  try {
    const items = await searchBooks(createSupabaseClient(), query)
    if (!isCancelled()) setItems(items)
  } catch {
    if (!isCancelled())
      setErrorMessage('도서 검색을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.')
  } finally {
    if (!isCancelled()) {
      setIsBookLoaderVisible(false)
      setIsSearching(false)
    }
  }
}
