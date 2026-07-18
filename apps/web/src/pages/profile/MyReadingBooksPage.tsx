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
import {
  calculateReadingProgressPercent,
  getMyReadingProgresses,
  readingProgressKeys,
  upsertReadingProgress,
  type ReadingProgress,
  type ReadingProgressInput,
} from '../../entities/reading-progress'
import { CompletionReviewForm } from '../../features/book-completion'
import { useAuthenticatedUser } from '../../features/auth'
import { ReadingProgressForm } from '../../features/reading-progress'
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
  onOpenProgress: (book: ReadingBook) => void
  progress: ReadingProgress | undefined
}

type ReadingBookGroupsProps = {
  books: ReadingBook[]
  completedBooksByChatId: ReadonlyMap<string, CompletedBook>
  onOpenCompletion: (book: ReadingBook) => void
  onOpenProgress: (book: ReadingBook) => void
  progressesByBookChatId: ReadonlyMap<string, ReadingProgress>
}

/** 참여한 모든 책방의 읽는 책을 조회하고 완독 기록을 작성하거나 수정한다. */
export function MyReadingBooksPage() {
  const navigate = useNavigate()
  const profileId = useAuthenticatedUser().id
  const queryClient = useQueryClient()
  const [selectedBook, setSelectedBook] = useState<ReadingBook | null>(null)
  const [selectedProgressBook, setSelectedProgressBook] = useState<ReadingBook | null>(null)
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
  const readingProgressesQuery = useQuery({
    queryFn: () => getMyReadingProgresses(createSupabaseClient(), profileId),
    queryKey: readingProgressKeys.byProfile(profileId),
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
  const saveReadingProgressMutation = useMutation({
    mutationFn: (input: ReadingProgressInput) =>
      upsertReadingProgress(createSupabaseClient(), input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: readingProgressKeys.byProfile(profileId) })
      setSelectedProgressBook(null)
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

  /** 선택한 책을 개인 독서 진행률 시트의 편집 대상으로 저장한다. */
  function handleOpenProgress(book: ReadingBook) {
    setSelectedProgressBook(book)
  }

  /** 열린 완독 기록 시트를 닫고 선택된 책 상태를 초기화한다. */
  function handleCloseCompletion() {
    setSelectedBook(null)
  }

  /** 열린 독서 진행률 시트를 닫고 선택된 책 상태를 초기화한다. */
  function handleCloseProgress() {
    setSelectedProgressBook(null)
  }

  /** 별점과 총평을 현재 선택된 책의 완독 기록으로 저장한다. */
  function handleSaveCompletion(input: BookCompletionInput) {
    saveCompletionMutation.mutate(input)
  }

  /** 입력한 개인 독서 진행률을 선택한 책 대화에 저장한다. */
  function handleSaveProgress(input: ReadingProgressInput) {
    saveReadingProgressMutation.mutate(input)
  }

  const isLoading =
    completedBooksQuery.isPending || readingBooksQuery.isPending || readingProgressesQuery.isPending
  const hasError =
    completedBooksQuery.isError || readingBooksQuery.isError || readingProgressesQuery.isError
  const completedBooksByChatId = createCompletedBooksByChatId(completedBooksQuery.data ?? [])
  const selectedCompletion = selectedBook
    ? completedBooksByChatId.get(selectedBook.bookChatId)
    : undefined
  const progressesByBookChatId = createReadingProgressesByBookChatId(
    readingProgressesQuery.data ?? [],
  )
  const selectedProgress = selectedProgressBook
    ? progressesByBookChatId.get(selectedProgressBook.bookChatId)
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
          onOpenProgress={handleOpenProgress}
          progressesByBookChatId={progressesByBookChatId}
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
      {selectedProgressBook ? (
        <ReadingProgressRecordSheet
          isSaving={saveReadingProgressMutation.isPending}
          onClose={handleCloseProgress}
          onSave={handleSaveProgress}
          progress={selectedProgress}
          selectedBook={selectedProgressBook}
        />
      ) : null}
    </main>
  )
}

/** 선택한 책의 개인 독서 진행 페이지를 입력받아 저장하는 시트를 렌더링한다. */
function ReadingProgressRecordSheet({
  isSaving,
  onClose,
  onSave,
  progress,
  selectedBook,
}: {
  isSaving: boolean
  onClose: () => void
  onSave: (input: ReadingProgressInput) => void
  progress: ReadingProgress | undefined
  selectedBook: ReadingBook
}) {
  return (
    <BottomSheet onClose={onClose} title="독서 진행률 기록">
      <p className="text-ink text-sm font-semibold">{selectedBook.title}</p>
      <ReadingProgressForm
        bookChatId={selectedBook.bookChatId}
        initialCurrentPage={progress?.currentPage ?? null}
        initialTotalPages={progress?.totalPages ?? null}
        isSaving={isSaving}
        key={`${selectedBook.bookChatId}-${progress?.updatedAt ?? 'new'}`}
        onCancel={onClose}
        onSave={onSave}
      />
    </BottomSheet>
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
  onOpenProgress,
  progressesByBookChatId,
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
                  onOpenProgress={onOpenProgress}
                  progress={progressesByBookChatId.get(book.bookChatId)}
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
function ReadingBookCard({
  book,
  completion,
  onOpenCompletion,
  onOpenProgress,
  progress,
}: ReadingBookCardProps) {
  const isCompleted = Boolean(completion)
  const actionLabel = isCompleted ? '기록 수정' : '완독하기'

  /** 현재 카드의 책을 완독 기록 작성 또는 수정 대상으로 연다. */
  function handleOpenCompletion() {
    onOpenCompletion(book)
  }

  /** 현재 카드의 책을 개인 독서 진행률 기록 대상으로 연다. */
  function handleOpenProgress() {
    onOpenProgress(book)
  }

  const progressPercent = progress
    ? calculateReadingProgressPercent(progress.currentPage, progress.totalPages)
    : null

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
          {progress && progressPercent !== null ? (
            <span className="mt-2 block">
              <span className="text-primary flex items-center justify-between text-xs font-semibold">
                <span>{`${progress.currentPage} / ${progress.totalPages}쪽`}</span>
                <span>{`${progressPercent}%`}</span>
              </span>
              <progress
                aria-label={`${book.title} 독서 진행률`}
                className="accent-primary mt-1 h-2 w-full"
                max={progress.totalPages}
                value={progress.currentPage}
              >
                {progressPercent}%
              </progress>
            </span>
          ) : null}
        </span>
        <span aria-hidden="true" className="text-ink-subtle text-lg">
          ›
        </span>
      </Link>
      <div className="border-ink/10 grid grid-cols-2 gap-2 border-t px-3 py-2">
        <button
          aria-label={`${book.title} 진행률 기록하기`}
          className="border-primary text-primary min-h-11 cursor-pointer rounded-md border bg-white px-3 text-sm font-semibold"
          onClick={handleOpenProgress}
          type="button"
        >
          진행률 기록하기
        </button>
        <button
          aria-label={`${book.title} ${actionLabel}`}
          className={`min-h-11 cursor-pointer rounded-md px-3 text-sm font-semibold ${
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

/** 개인 독서 진행률 배열을 책 대화 식별자로 빠르게 조회할 수 있는 Map으로 변환한다. */
function createReadingProgressesByBookChatId(
  progresses: ReadingProgress[],
): ReadonlyMap<string, ReadingProgress> {
  return new Map(progresses.map((progress) => [progress.bookChatId, progress]))
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
