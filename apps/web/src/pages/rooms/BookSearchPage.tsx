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
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null)

  useEffect(() => {
    async function protectRoute() {
      const response = await createSupabaseClient().auth.getUser()
      if (response.error || !response.data.user) void navigate('/', { replace: true })
    }

    void protectRoute()
  }, [navigate])

  async function handleSearch() {
    const parsed = querySchema.safeParse(query)
    if (!parsed.success) {
      setErrorMessage(parsed.error.issues[0]?.message ?? '검색어를 확인해 주세요.')
      return
    }
    setErrorMessage(null)
    setIsSearching(true)
    try {
      setItems(await searchBooks(createSupabaseClient(), parsed.data))
    } catch {
      setErrorMessage('도서 검색에 실패했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsSearching(false)
    }
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
    <main className="bg-surface mx-auto min-h-screen w-full max-w-md px-6 py-8">
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
      <form
        className="mt-8 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          void handleSearch()
        }}
      >
        <input
          className="border-ink/10 focus:border-primary min-h-12 min-w-0 flex-1 rounded-md border bg-white px-4 text-sm outline-none"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="책 제목이나 저자"
          value={query}
        />
        <button
          className="bg-primary min-h-12 rounded-md px-4 text-sm font-semibold text-white"
          disabled={isSearching}
          type="submit"
        >
          검색
        </button>
      </form>
      {errorMessage ? (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <BookResults items={items} isCreatingId={selectedBookId} onSelect={handleSelectBook} />
    </main>
  )
}

function BookResults({
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
        검색할 책의 제목이나 저자를 입력해 주세요.
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
