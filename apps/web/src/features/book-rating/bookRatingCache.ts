import type { QueryClient } from '@tanstack/react-query'

import { bookRatingKeys, type BookChatRating, type RatedBook } from '../../entities/book-rating'

type BookRatingCacheInput = {
  bookChatId: string
  profileId: string
  rating: number
  review: string | null
}

type BookRatingCacheTarget = Pick<BookRatingCacheInput, 'bookChatId' | 'profileId'>

/** 저장된 개인 별점을 책 대화방 별점 현황과 이미 캐시된 내 별점 도서에 즉시 반영한다. */
export function storeBookRatingInCache(queryClient: QueryClient, input: BookRatingCacheInput) {
  const rating = createOwnRating(input)
  queryClient.setQueryData<BookChatRating[]>(
    bookRatingKeys.byChat(input.bookChatId),
    (ratings = []) => [...ratings.filter((item) => item.profileId !== input.profileId), rating],
  )
  queryClient.setQueryData<RatedBook[]>(bookRatingKeys.myBooks(input.profileId), (books) =>
    updateRatedBook(books, input),
  )
}

/** 취소한 개인 별점만 공용 캐시에서 제거한다. */
export function removeBookRatingFromCache(queryClient: QueryClient, target: BookRatingCacheTarget) {
  queryClient.setQueryData<BookChatRating[]>(
    bookRatingKeys.byChat(target.bookChatId),
    (ratings = []) => ratings.filter((item) => item.profileId !== target.profileId),
  )
  queryClient.setQueryData<RatedBook[]>(bookRatingKeys.myBooks(target.profileId), (books) =>
    books?.filter((book) => book.bookChatId !== target.bookChatId),
  )
}

/** 입력한 별점·총평으로 현재 사용자의 화면용 별점 모델을 생성한다. */
function createOwnRating(input: BookRatingCacheInput): BookChatRating {
  return {
    avatarPath: null,
    displayName: '나',
    isMe: true,
    profileId: input.profileId,
    rating: input.rating,
    review: input.review,
    updatedAt: new Date().toISOString(),
  }
}

/** 이미 캐시된 내 별점 도서가 있을 때만 별점과 총평을 갱신한다. */
function updateRatedBook(
  books: RatedBook[] | undefined,
  input: BookRatingCacheInput,
): RatedBook[] | undefined {
  return books?.map((book) =>
    book.bookChatId === input.bookChatId
      ? { ...book, rating: input.rating, review: input.review, updatedAt: new Date().toISOString() }
      : book,
  )
}
