import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { ActionButton } from '@seed-design/react'

import { bookChatKeys, getMyReadingBooks, type ReadingBook } from '../../entities/book-chat'
import {
  bookRatingKeys,
  getMyRatedBooks,
  upsertBookChatRating,
  type BookRatingInput,
  type RatedBook,
} from '../../entities/book-rating'
import { useAuthenticatedUser } from '../../features/auth'
import {
  invalidateRatingQueries,
  RatingForm,
  storeBookRatingInCache,
} from '../../features/book-rating'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { AppHeader } from '../../shared/ui/AppHeader'
import { BookCover } from '../../shared/ui/BookCover'
import { BottomSheet } from '../../shared/ui/BottomSheet'
import { BookLoadingIndicator } from '../../shared/ui/LoadingSpinner'
import { RatingStars } from '../../shared/ui/RatingStars'
import { RetryState } from '../../shared/ui/RetryState'

type RatingSheetProps = {
  errorMessage: string | null
  isSaving: boolean
  onClose: () => void
  onSave: (input: BookRatingInput) => void
  rating: RatedBook | undefined
  selectedBook: ReadingBook
}

type ReadingBookCardProps = {
  book: ReadingBook
  onOpenRating: (book: ReadingBook) => void
  rating: RatedBook | undefined
}

type ReadingBookGroupsProps = {
  books: ReadingBook[]
  onOpenRating: (book: ReadingBook) => void
  ratingsByChatId: ReadonlyMap<string, RatedBook>
}

/** 참여한 모든 책방의 책을 조회하고 책마다 내 별점을 남기거나 수정한다. */
export function MyReadingBooksPage() {
  const navigate = useNavigate()
  const profileId = useAuthenticatedUser().id
  const queryClient = useQueryClient()
  const [selectedBook, setSelectedBook] = useState<ReadingBook | null>(null)
  const readingBooksQuery = useQuery({
    queryFn: () => getMyReadingBooks(createSupabaseClient(), profileId),
    queryKey: bookChatKeys.myReading(profileId, []),
  })
  const ratedBooksQuery = useQuery({
    queryFn: () => getMyRatedBooks(createSupabaseClient(), profileId),
    queryKey: bookRatingKeys.myBooks(profileId),
  })
  const saveRatingMutation = useMutation({
    mutationFn: (input: BookRatingInput) => upsertBookChatRating(createSupabaseClient(), input),
    onSuccess: (_result, input) => {
      storeBookRatingInCache(queryClient, { ...input, profileId })
      invalidateRatingQueries(queryClient, input.bookChatId, profileId)
      setSelectedBook(null)
    },
  })

  /** 내 책 목록과 내 별점을 함께 다시 요청한다. */
  function handleRetry() {
    void readingBooksQuery.refetch()
    void ratedBooksQuery.refetch()
  }

  /** 선택한 책을 별점 시트의 편집 대상으로 저장한다. */
  function handleOpenRating(book: ReadingBook) {
    saveRatingMutation.reset()
    setSelectedBook(book)
  }

  /** 열린 별점 시트를 닫고 선택된 책 상태를 초기화한다. */
  function handleCloseRating() {
    setSelectedBook(null)
  }

  /** 별점과 총평을 현재 선택된 책의 내 별점으로 저장한다. */
  function handleSaveRating(input: BookRatingInput) {
    saveRatingMutation.mutate(input)
  }

  const isLoading = readingBooksQuery.isPending || ratedBooksQuery.isPending
  const hasError = readingBooksQuery.isError || ratedBooksQuery.isError
  const ratingsByChatId = createRatingsByChatId(ratedBooksQuery.data ?? [])

  return (
    <main className="app-page bg-surface px-4 pb-8">
      <AppHeader onBack={() => void navigate('/profile')} title="내 책" />
      <header className="mt-8">
        <h1 className="text-ink text-xl font-bold">내 책</h1>
        <p className="text-ink-subtle mt-2 text-sm">
          참여한 책방의 책과 내가 남긴 별점을 모아 봐요.
        </p>
      </header>

      {isLoading ? (
        <div className="mt-12">
          <BookLoadingIndicator label="내 책을 불러오고 있어요." size="sm" />
        </div>
      ) : null}
      {hasError ? (
        <div className="mt-12">
          <RetryState
            message="내 책을 불러오지 못했어요. 잠시 후 다시 시도해 주세요."
            onRetry={handleRetry}
          />
        </div>
      ) : null}
      {!isLoading && !hasError ? (
        <ReadingBookGroups
          books={readingBooksQuery.data ?? []}
          onOpenRating={handleOpenRating}
          ratingsByChatId={ratingsByChatId}
        />
      ) : null}
      {selectedBook ? (
        <RatingSheet
          errorMessage={
            saveRatingMutation.isError
              ? '별점을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.'
              : null
          }
          isSaving={saveRatingMutation.isPending}
          onClose={handleCloseRating}
          onSave={handleSaveRating}
          rating={ratingsByChatId.get(selectedBook.bookChatId)}
          selectedBook={selectedBook}
        />
      ) : null}
    </main>
  )
}

/** 선택한 책의 내 별점을 불러와 작성하거나 수정하는 시트를 렌더링한다. */
function RatingSheet({
  errorMessage,
  isSaving,
  onClose,
  onSave,
  rating,
  selectedBook,
}: RatingSheetProps) {
  return (
    <BottomSheet onClose={onClose} title="별점 남기기">
      <p className="text-ink text-sm font-semibold">{selectedBook.title}</p>
      <RatingForm
        bookChatId={selectedBook.bookChatId}
        initialRating={rating?.rating ?? null}
        initialReview={rating?.review ?? null}
        isSaving={isSaving}
        key={`${selectedBook.bookChatId}-${rating?.updatedAt ?? 'new'}`}
        onCancel={onClose}
        onSave={onSave}
        submitLabel={rating ? '별점 수정' : '별점 저장'}
      />
      {errorMessage ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </BottomSheet>
  )
}

/** 책방 이름을 기준으로 책을 묶어 별점 CTA와 함께 렌더링한다. */
function ReadingBookGroups({ books, onOpenRating, ratingsByChatId }: ReadingBookGroupsProps) {
  const groups = groupReadingBooksByRoom(books)
  if (groups.length === 0) {
    return (
      <section className="talkhugam-information-surface border-border mt-12 rounded-lg border p-6 text-center">
        <h2 className="text-ink text-base font-semibold">아직 함께 읽는 책이 없어요</h2>
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
          <h2 className="text-ink text-base font-semibold" id={`room-${group.roomId}`}>
            {group.roomName}
          </h2>
          <ul className="mt-4 space-y-3">
            {group.books.map((book) => (
              <li key={book.bookChatId}>
                <ReadingBookCard
                  book={book}
                  onOpenRating={onOpenRating}
                  rating={ratingsByChatId.get(book.bookChatId)}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

/** 하나의 책에 책 대화 이동 링크와 내 별점 또는 별점 남기기 행동을 함께 렌더링한다. */
function ReadingBookCard({ book, onOpenRating, rating }: ReadingBookCardProps) {
  const actionLabel = rating ? '수정하기' : '별점 남기기'

  /** 현재 카드의 책을 별점 작성 또는 수정 대상으로 연다. */
  function handleOpenRating() {
    onOpenRating(book)
  }

  return (
    <article className="talkhugam-information-surface border-border overflow-hidden rounded-lg border">
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
        </span>
        <span aria-hidden="true" className="text-ink-subtle text-lg">
          ›
        </span>
      </Link>
      <div className="border-border flex min-h-14 items-center justify-between gap-3 border-t px-3 py-2">
        {rating ? (
          <RatingStars rating={rating.rating} />
        ) : (
          <span className="text-ink-subtle text-xs">별점과 총평을 남길 수 있어요.</span>
        )}
        <ActionButton
          aria-label={rating ? `${book.title} 별점 수정하기` : `${book.title} 별점 남기기`}
          className="talkhugam-foundation-action--outline"
          onClick={handleOpenRating}
          type="button"
          variant="neutralOutline"
        >
          {actionLabel}
        </ActionButton>
      </div>
    </article>
  )
}

/** 내 별점 도서 배열을 책 대화 식별자로 빠르게 조회할 수 있는 Map으로 변환한다. */
function createRatingsByChatId(ratedBooks: RatedBook[]): ReadonlyMap<string, RatedBook> {
  return new Map(ratedBooks.map((book) => [book.bookChatId, book]))
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
