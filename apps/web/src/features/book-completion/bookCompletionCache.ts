import type { QueryClient } from '@tanstack/react-query'

import { bookChatKeys, type ReadingBook } from '../../entities/book-chat'
import { bookCompletionKeys, type BookChatCompletion } from '../../entities/book-completion'
import { readingProgressKeys, type ReadingProgress } from '../../entities/reading-progress'

type BookCompletionCacheInput = {
  bookChatId: string
  profileId: string
  rating: number | null
  review: string | null
}

type BookCompletionCacheTarget = Pick<BookCompletionCacheInput, 'bookChatId' | 'profileId'>

/** 저장된 개인 완독 기록을 책 대화·책방·내 정보가 공유하는 캐시에 즉시 반영한다. */
export function storeBookCompletionInCache(
  queryClient: QueryClient,
  input: BookCompletionCacheInput,
) {
  const completion = createOwnCompletion(input)
  queryClient.setQueryData<BookChatCompletion[]>(
    bookCompletionKeys.byChat(input.bookChatId),
    (completions = []) => [
      ...completions.filter((item) => item.profileId !== input.profileId),
      completion,
    ],
  )
  queryClient.setQueryData<string[]>(
    bookCompletionKeys.myBookChatIds(input.profileId),
    (ids = []) => (ids.includes(input.bookChatId) ? ids : [...ids, input.bookChatId]),
  )
  queryClient.setQueriesData<ReadingBook[]>(
    { queryKey: bookChatKeys.myReading(input.profileId, []) },
    (books) => markReadingBookCompletion(books, input.bookChatId, true),
  )
  queryClient.setQueryData<ReadingProgress[]>(
    readingProgressKeys.byProfile(input.profileId),
    (progresses) => completeCachedReadingProgress(progresses, input.bookChatId),
  )
}

/** 취소한 개인 완독 기록만 공용 캐시에서 제거하고 기존 진행률은 보존한다. */
export function removeBookCompletionFromCache(
  queryClient: QueryClient,
  target: BookCompletionCacheTarget,
) {
  queryClient.setQueryData<BookChatCompletion[]>(
    bookCompletionKeys.byChat(target.bookChatId),
    (completions = []) => completions.filter((item) => item.profileId !== target.profileId),
  )
  queryClient.setQueryData<string[]>(
    bookCompletionKeys.myBookChatIds(target.profileId),
    (ids = []) => ids.filter((id) => id !== target.bookChatId),
  )
  queryClient.setQueriesData<ReadingBook[]>(
    { queryKey: bookChatKeys.myReading(target.profileId, []) },
    (books) => markReadingBookCompletion(books, target.bookChatId, false),
  )
}

/** 입력한 별점·총평으로 현재 사용자의 화면용 완독 모델을 생성한다. */
function createOwnCompletion(input: BookCompletionCacheInput): BookChatCompletion {
  return {
    avatarPath: null,
    completedAt: new Date().toISOString(),
    displayName: '나',
    isMe: true,
    profileId: input.profileId,
    rating: input.rating,
    review: input.review,
  }
}

/** 동일 책 대화의 개인 읽는 책 표시만 완독 여부에 맞게 변경한다. */
function markReadingBookCompletion(
  books: ReadingBook[] | undefined,
  bookChatId: string,
  isCompleted: boolean,
): ReadingBook[] | undefined {
  return books?.map((book) => (book.bookChatId === bookChatId ? { ...book, isCompleted } : book))
}

/** 기존 개인 진행률이 있을 때만 마지막 페이지까지 읽은 상태로 맞춘다. */
function completeCachedReadingProgress(
  progresses: ReadingProgress[] | undefined,
  bookChatId: string,
): ReadingProgress[] | undefined {
  return progresses?.map((progress) =>
    progress.bookChatId === bookChatId
      ? { ...progress, currentPage: progress.totalPages, updatedAt: new Date().toISOString() }
      : progress,
  )
}
