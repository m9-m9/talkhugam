import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'

import { bookChatKeys, getMyReadingBooks, type ReadingBook } from '../../entities/book-chat'
import { bookCompletionKeys, getMyBookChatCompletionIds } from '../../entities/book-completion'
import { useAuthenticatedUser } from '../../features/auth'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { AppHeader } from '../../shared/ui/AppHeader'
import { BookCover } from '../../shared/ui/BookCover'
import { CompletionMark } from '../../shared/ui/CompletionMark'
import { LoadingSpinner } from '../../shared/ui/LoadingSpinner'
import { RetryState } from '../../shared/ui/RetryState'

/** 참여 중인 독서방 전체의 읽는 책과 개인 완독 표시를 한 화면에 렌더링한다. */
export function MyReadingBooksPage() {
  const navigate = useNavigate()
  const profileId = useAuthenticatedUser().id
  const completionIdsQuery = useQuery({
    queryFn: () => getMyBookChatCompletionIds(createSupabaseClient(), profileId),
    queryKey: bookCompletionKeys.myBookChatIds(profileId),
  })
  const readingBooksQuery = useQuery({
    enabled: completionIdsQuery.isSuccess,
    queryFn: () =>
      getMyReadingBooks(createSupabaseClient(), profileId, completionIdsQuery.data ?? []),
    queryKey: bookChatKeys.myReading(profileId, completionIdsQuery.data ?? []),
  })

  /** 읽는 책과 개인 완독 표식을 함께 다시 요청한다. */
  function handleRetry() {
    void completionIdsQuery.refetch().then(() => readingBooksQuery.refetch())
  }

  const isLoading = completionIdsQuery.isPending || readingBooksQuery.isPending
  const hasError = completionIdsQuery.isError || readingBooksQuery.isError

  return (
    <main className="app-page bg-surface px-4 pb-8">
      <AppHeader onBack={() => void navigate('/profile')} title="읽고 있는 책" />
      <header className="mt-8">
        <p className="text-primary text-sm font-medium">책 기록</p>
        <h1 className="text-ink mt-2 text-xl font-bold">함께 읽고 있는 책</h1>
        <p className="text-ink-subtle mt-2 text-sm">참여 중인 모든 독서방의 책을 모아 봐요.</p>
      </header>

      {isLoading ? (
        <div className="mt-12">
          <LoadingSpinner label="읽고 있는 책을 불러오고 있어요." size="sm" variant="book" />
        </div>
      ) : null}
      {hasError ? (
        <div className="mt-12">
          <RetryState
            message="읽고 있는 책을 불러오지 못했어요. 잠시 후 다시 시도해 주세요."
            onRetry={handleRetry}
          />
        </div>
      ) : null}
      {!isLoading && !hasError ? <ReadingBookGroups books={readingBooksQuery.data ?? []} /> : null}
    </main>
  )
}

/** 독서방 이름을 기준으로 읽는 책을 묶어 목록으로 렌더링한다. */
function ReadingBookGroups({ books }: { books: ReadingBook[] }) {
  const groups = groupReadingBooksByRoom(books)
  if (groups.length === 0)
    return (
      <section className="bg-surface-muted mt-12 rounded-lg p-6 text-center">
        <h2 className="text-ink text-base font-bold">아직 읽고 있는 책이 없어요</h2>
        <p className="text-ink-subtle mt-2 text-sm">
          독서방에서 첫 책을 골라 이야기를 시작해 보세요.
        </p>
      </section>
    )

  return (
    <div className="mt-12 space-y-8">
      {groups.map((group) => (
        <section aria-labelledby={`room-${group.roomId}`} key={group.roomId}>
          <h2 className="text-ink text-base font-bold" id={`room-${group.roomId}`}>
            {group.roomName}
          </h2>
          <ul className="mt-4 space-y-3">
            {group.books.map((book) => (
              <li key={book.bookChatId}>
                <ReadingBookCard book={book} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

/** 하나의 읽는 책을 표지, 독서방, 개인 완독 표시와 함께 링크 카드로 렌더링한다. */
function ReadingBookCard({ book }: { book: ReadingBook }) {
  return (
    <Link
      aria-label={`${book.title} 책 대화로 이동`}
      className="border-ink/10 hover:border-primary flex min-h-20 items-center gap-3 rounded-lg border bg-white p-3"
      to={`/rooms/${book.roomId}/books/${book.bookChatId}`}
    >
      <BookCover alt="" thumbnailUrl={book.thumbnailUrl} />
      <span className="min-w-0 flex-1">
        <span className="text-ink block truncate text-sm font-semibold">{book.title}</span>
        <span className="text-ink-subtle mt-1 block truncate text-xs">
          {book.authors.join(', ') || '저자 정보 없음'}
        </span>
        {book.isCompleted ? <CompletionMark className="mt-2" /> : null}
      </span>
      <span aria-hidden="true" className="text-ink-subtle text-lg">
        ›
      </span>
    </Link>
  )
}

/** 읽는 책 목록을 독서방 순서대로 묶어 렌더링에 필요한 구조로 변환한다. */
function groupReadingBooksByRoom(books: ReadingBook[]): Array<{
  books: ReadingBook[]
  roomId: string
  roomName: string
}> {
  const groupsByRoom = new Map<string, { books: ReadingBook[]; roomId: string; roomName: string }>()
  for (const book of books) {
    const existingGroup = groupsByRoom.get(book.roomId)
    if (existingGroup) {
      existingGroup.books.push(book)
      continue
    }
    groupsByRoom.set(book.roomId, { books: [book], roomId: book.roomId, roomName: book.roomName })
  }
  return Array.from(groupsByRoom.values())
}
