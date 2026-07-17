import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'

import {
  bookChatKeys,
  createBookChat,
  searchBooks,
  type BookSearchItem,
} from '../../entities/book-chat'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { useQueryClient } from '@tanstack/react-query'

const querySchema = z
  .string()
  .trim()
  .min(2, '책 제목이나 저자를 두 글자 이상 입력해 주세요.')
  .max(100)

export function BookSearchPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { roomId } = useParams()
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<BookSearchItem[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [searchVersion, setSearchVersion] = useState(0)
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null)

  useEffect(() => {
    async function protectRoute() {
      const response = await createSupabaseClient().auth.getUser()
      if (response.error || !response.data.user) void navigate('/', { replace: true })
    }

    void protectRoute()
  }, [navigate])

  useEffect(() => {
    const parsed = querySchema.safeParse(query)
    if (!parsed.success) return

    let wasCancelled = false
    const timeoutId = window.setTimeout(() => {
      void searchBooksForQuery(
        parsed.data,
        () => wasCancelled,
        setErrorMessage,
        setIsSearching,
        setItems,
      )
    }, 300)

    return () => {
      wasCancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [query, searchVersion])

  function handleQueryChange(value: string) {
    const isValidQuery = querySchema.safeParse(value).success
    setQuery(value)
    setItems([])
    setErrorMessage(value.trim().length > 100 ? '검색어는 100자 이하로 입력해 주세요.' : null)
    setIsSearching(isValidQuery)
  }

  function handleSearch() {
    const parsed = querySchema.safeParse(query)
    if (!parsed.success) {
      setErrorMessage(parsed.error.issues[0]?.message ?? '검색어를 확인해 주세요.')
      return
    }

    setItems([])
    setErrorMessage(null)
    setIsSearching(true)
    setSearchVersion((version) => version + 1)
  }

  async function handleSelectBook(book: BookSearchItem) {
    if (!roomId) return
    setSelectedBookId(book.title)
    try {
      await createBookChat(createSupabaseClient(), roomId, book)
      await queryClient.invalidateQueries({ queryKey: bookChatKeys.byRoom(roomId) })
      void navigate(`/rooms/${roomId}`, { replace: true })
    } catch {
      setErrorMessage('이 책을 추가하지 못했어요. 잠시 후 다시 시도해 주세요.')
      setSelectedBookId(null)
    }
  }

  return (
    <main className="app-page bg-surface px-6 py-8">
      <button
        className="text-ink-subtle -ml-3 min-h-11 px-3 text-sm"
        onClick={() => void navigate(-1)}
        type="button"
      >
        ← 뒤로
      </button>
      <header className="mt-3">
        <h1 className="text-ink text-xl font-bold">무슨 책으로 이야기 나눌까요?</h1>
        <p className="text-ink-subtle mt-2 text-sm">책 제목이나 저자를 검색해 보세요.</p>
      </header>
      <div className="mt-8 flex gap-2">
        <input
          className="border-ink/10 focus:border-primary min-h-12 min-w-0 flex-1 rounded-md border bg-white px-4 text-sm outline-none"
          onChange={(event) => handleQueryChange(event.target.value)}
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
        hasQuery={query.trim().length >= 2}
        isCreatingId={selectedBookId}
        isSearching={isSearching}
        items={items}
        onSelect={handleSelectBook}
      />
    </main>
  )
}

function BookResults({
  hasQuery,
  isCreatingId,
  isSearching,
  items,
  onSelect,
}: {
  hasQuery: boolean
  isCreatingId: string | null
  isSearching: boolean
  items: BookSearchItem[]
  onSelect: (book: BookSearchItem) => void
}) {
  if (isSearching)
    return <p className="text-ink-subtle mt-12 text-center text-sm">책을 찾고 있어요…</p>

  if (items.length === 0 && hasQuery)
    return <p className="text-ink-subtle mt-12 text-center text-sm">검색 결과가 없어요.</p>

  if (items.length === 0)
    return (
      <p className="text-ink-subtle mt-12 text-center text-sm">
        책 제목이나 저자를 두 글자 이상 입력해 주세요.
      </p>
    )
  return (
    <ul className="mt-6 space-y-3">
      {items.map((book) => (
        <li key={`${book.title}-${book.isbn13 ?? book.isbn10 ?? book.externalUrl ?? ''}`}>
          <button
            className="border-ink/10 min-h-16 w-full rounded-lg border bg-white p-4 text-left"
            disabled={isCreatingId !== null}
            onClick={() => void onSelect(book)}
            type="button"
          >
            <span className="text-ink block text-sm font-bold">{book.title}</span>
            <span className="text-ink-subtle mt-1 block text-xs">
              {book.authors.join(', ')}
              {book.publisher ? ` · ${book.publisher}` : ''}
            </span>
            {isCreatingId === book.title ? (
              <span className="text-primary mt-2 block text-xs">책 채팅방을 만들고 있어요…</span>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  )
}

async function searchBooksForQuery(
  query: string,
  isCancelled: () => boolean,
  setErrorMessage: (message: string | null) => void,
  setIsSearching: (isSearching: boolean) => void,
  setItems: (items: BookSearchItem[]) => void,
) {
  setErrorMessage(null)
  setIsSearching(true)

  try {
    const items = await searchBooks(createSupabaseClient(), query)
    if (!isCancelled()) setItems(items)
  } catch {
    if (!isCancelled()) setErrorMessage('도서 검색에 실패했어요. 잠시 후 다시 시도해 주세요.')
  } finally {
    if (!isCancelled()) setIsSearching(false)
  }
}
