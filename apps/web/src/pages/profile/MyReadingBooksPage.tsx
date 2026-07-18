import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { bookChatKeys, getMyReadingBooks, type ReadingBook } from '../../entities/book-chat'
import {
  bookCompletionKeys,
  getMyCompletedBooks,
  upsertBookChatCompletion,
  type BookCompletionInput,
  type CompletedBook,
} from '../../entities/book-completion'
import { CompletionReviewForm } from '../../features/book-completion'
import { useAuthenticatedUser } from '../../features/auth'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { AppHeader } from '../../shared/ui/AppHeader'
import { BookCover } from '../../shared/ui/BookCover'
import { BottomSheet } from '../../shared/ui/BottomSheet'
import { CompletionMark } from '../../shared/ui/CompletionMark'
import { LoadingSpinner } from '../../shared/ui/LoadingSpinner'
import { RetryState } from '../../shared/ui/RetryState'

type CompletionRecordSheetProps = {
  completion: CompletedBook | undefined
  isSaving: boolean
  onClose: () => void
  onSave: (input: BookCompletionInput) => void
  selectedBook: ReadingBook
}

type ReadingBookCardProps = {
  book: ReadingBook
  completion: CompletedBook | undefined
  onOpenCompletion: (book: ReadingBook) => void
}

type ReadingBookGroupsProps = {
  books: ReadingBook[]
  completedBooksByChatId: ReadonlyMap<string, CompletedBook>
  onOpenCompletion: (book: ReadingBook) => void
}

/** 참여한 모든 책방의 읽는 책을 조회하고 완독 기록을 작성하거나 수정한다. */
export function MyReadingBooksPage() {
  const navigate = useNavigate()
  const profileId = useAuthenticatedUser().id
  const queryClient = useQueryClient()
  const [selectedBook, setSelectedBook] = useState<ReadingBook | null>(null)
  const completedBooksQuery = useQuery({
    queryFn: () => getMyCompletedBooks(createSupabaseClient(), profileId),
    queryKey: bookCompletionKeys.myBooks(profileId),
  })
  const completedBookChatIds = completedBooksQuery.data?.map((book) => book.bookChatId) ?? []
  const readingBooksQuery = useQuery({
    enabled: completedBooksQuery.isSuccess,
    queryFn: () => getMyReadingBooks(createSupabaseClient(), profileId, completedBookChatIds),
    queryKey: bookChatKeys.myReading(profileId, completedBookChatIds),
  })
  const saveCompletionMutation = useMutation({
    mutationFn: (input: BookCompletionInput) =>
      upsertBookChatCompletion(createSupabaseClient(), input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: bookCompletionKeys.myBooks(profileId) }),
        queryClient.invalidateQueries({ queryKey: ['my-reading-books', profileId] }),
      ])
      setSelectedBook(null)
    },
  })

  /** 읽는 책과 완독 기록을 순서대로 다시 요청한다. */
  function handleRetry() {
    void completedBooksQuery.refetch()
  }

  /** 선택한 책을 완독 기록 시트의 편집 대상으로 저장한다. */
  function handleOpenCompletion(book: ReadingBook) {
    setSelectedBook(book)
  }

  /** 열린 완독 기록 시트를 닫고 선택된 책 상태를 초기화한다. */
  function handleCloseCompletion() {
    setSelectedBook(null)
  }

  /** 별점과 총평을 현재 선택된 책의 완독 기록으로 저장한다. */
  function handleSaveCompletion(input: BookCompletionInput) {
    saveCompletionMutation.mutate(input)
  }

  const isLoading = completedBooksQuery.isPending || readingBooksQuery.isPending
  const hasError = completedBooksQuery.isError || readingBooksQuery.isError
  const completedBooksByChatId = createCompletedBooksByChatId(completedBooksQuery.data ?? [])
  const selectedCompletion = selectedBook
    ? completedBooksByChatId.get(selectedBook.bookChatId)
    : undefined

  return (
    <main className="app-page bg-surface px-4 pb-8">
      <AppHeader onBack={() => void navigate('/profile')} title="읽고 있는 책" />
      <header className="mt-8">
        <p className="text-primary text-sm font-medium">책 기록</p>
        <h1 className="text-ink mt-2 text-xl font-bold">함께 읽고 있는 책</h1>
        <p className="text-ink-subtle mt-2 text-sm">참여 중인 모든 책방의 책을 모아 봐요.</p>
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
      {!isLoading && !hasError ? (
        <ReadingBookGroups
          books={readingBooksQuery.data ?? []}
          completedBooksByChatId={completedBooksByChatId}
          onOpenCompletion={handleOpenCompletion}
        />
      ) : null}
      {selectedBook ? (
        <CompletionRecordSheet
          completion={selectedCompletion}
          isSaving={saveCompletionMutation.isPending}
          onClose={handleCloseCompletion}
          onSave={handleSaveCompletion}
          selectedBook={selectedBook}
        />
      ) : null}
    </main>
  )
}

/** 선택한 책의 기존 기록을 보여 주고 완독 기록을 작성 또는 수정하는 시트를 렌더링한다. */
function CompletionRecordSheet({
  completion,
  isSaving,
  onClose,
  onSave,
  selectedBook,
}: CompletionRecordSheetProps) {
  const isEditing = Boolean(completion)

  return (
    <BottomSheet onClose={onClose} title="완독 기록">
      <p className="text-ink text-sm font-semibold">{selectedBook.title}</p>
      <CompletionReviewForm
        bookChatId={selectedBook.bookChatId}
        initialRating={completion?.rating ?? null}
        initialReview={completion?.review ?? null}
        isSaving={isSaving}
        key={`${selectedBook.bookChatId}-${completion?.completedAt ?? 'new'}`}
        onCancel={onClose}
        onSave={onSave}
        submitLabel={isEditing ? '기록 수정 저장' : '완독 기록 저장'}
      />
    </BottomSheet>
  )
}

/** 책방 이름을 기준으로 읽는 책을 묶어 완독 기록 CTA와 함께 렌더링한다. */
function ReadingBookGroups({
  books,
  completedBooksByChatId,
  onOpenCompletion,
}: ReadingBookGroupsProps) {
  const groups = groupReadingBooksByRoom(books)
  if (groups.length === 0) {
    return (
      <section className="bg-surface-muted mt-12 rounded-lg p-6 text-center">
        <h2 className="text-ink text-base font-bold">아직 읽고 있는 책이 없어요</h2>
        <p className="text-ink-subtle mt-2 text-sm">
          책방에서 첫 책을 골라 이야기를 시작해 보세요.
        </p>
      </section>
    )
  }

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
                <ReadingBookCard
                  book={book}
                  completion={completedBooksByChatId.get(book.bookChatId)}
                  onOpenCompletion={onOpenCompletion}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

/** 하나의 읽는 책에 이동 링크와 완독 작성 또는 수정 행동을 함께 렌더링한다. */
function ReadingBookCard({ book, completion, onOpenCompletion }: ReadingBookCardProps) {
  const isCompleted = Boolean(completion)
  const actionLabel = isCompleted ? '기록 수정' : '완독하기'

  /** 현재 카드의 책을 완독 기록 작성 또는 수정 대상으로 연다. */
  function handleOpenCompletion() {
    onOpenCompletion(book)
  }

  return (
    <article className="border-ink/10 overflow-hidden rounded-lg border bg-white">
      <Link
        aria-label={`${book.title} 책 대화로 이동`}
        className="hover:bg-surface-muted flex min-h-20 items-center gap-3 p-3"
        to={`/rooms/${book.roomId}/books/${book.bookChatId}`}
      >
        <BookCover alt="" thumbnailUrl={book.thumbnailUrl} />
        <span className="min-w-0 flex-1">
          <span className="text-ink block truncate text-sm font-semibold">{book.title}</span>
          <span className="text-ink-subtle mt-1 block truncate text-xs">
            {book.authors.join(', ') || '저자 정보 없음'}
          </span>
          {isCompleted ? <CompletionMark className="mt-2" /> : null}
        </span>
        <span aria-hidden="true" className="text-ink-subtle text-lg">
          ›
        </span>
      </Link>
      <div className="border-ink/10 flex items-center justify-between gap-3 border-t px-3 py-2">
        <span className="text-ink-subtle text-xs">
          {isCompleted ? '완독 기록을 남겼어요.' : '별점과 총평을 남길 수 있어요.'}
        </span>
        <button
          aria-label={`${book.title} ${actionLabel}`}
          className={`min-h-11 shrink-0 cursor-pointer rounded-md px-3 text-sm font-semibold ${
            isCompleted ? 'border-primary text-primary border bg-white' : 'bg-primary text-white'
          }`}
          onClick={handleOpenCompletion}
          type="button"
        >
          {actionLabel}
        </button>
      </div>
    </article>
  )
}

/** 완독 도서 배열을 책 대화 식별자로 빠르게 조회할 수 있는 Map으로 변환한다. */
function createCompletedBooksByChatId(
  completedBooks: CompletedBook[],
): ReadonlyMap<string, CompletedBook> {
  return new Map(completedBooks.map((book) => [book.bookChatId, book]))
}

/** 읽는 책 목록을 책방 순서대로 묶어 렌더링에 필요한 구조로 변환한다. */
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
