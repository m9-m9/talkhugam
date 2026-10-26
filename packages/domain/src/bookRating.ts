import { z } from 'zod'

export const ratedBookRowSchema = z.object({
  book_chat_id: z.string().uuid(),
  book_chats: z.object({
    books: z.object({
      authors: z.array(z.string()),
      thumbnail_url: z.string().url().nullable(),
      title: z.string(),
    }),
    room_id: z.string().uuid(),
  }),
  rating: z.number().int().min(1).max(5),
  review: z.string().nullable(),
  updated_at: z.string().datetime({ offset: true }),
})

export const bookChatRatingRowSchema = z.object({
  book_chats: z.object({
    room_members: z.array(
      z.object({
        profile_id: z.string().uuid(),
        room_avatar_path: z.string().nullable(),
        room_display_name: z.string(),
      }),
    ),
  }),
  profile_id: z.string().uuid(),
  profiles: z.object({
    avatar_path: z.string().nullable(),
    display_name: z.string(),
  }),
  rating: z.number().int().min(1).max(5),
  review: z.string().nullable(),
  updated_at: z.string().datetime({ offset: true }),
})

export const bookRatingInputSchema = z.object({
  bookChatId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  review: z.string().trim().max(1000).nullable(),
})

export type BookChatRating = {
  avatarPath: string | null
  displayName: string
  isMe: boolean
  profileId: string
  rating: number
  review: string | null
  updatedAt: string
}

export type BookRatingInput = z.infer<typeof bookRatingInputSchema>

export type RatedBook = {
  authors: string[]
  bookChatId: string
  rating: number
  review: string | null
  roomId: string
  thumbnailUrl: string | null
  title: string
  updatedAt: string
}

/** 웹과 네이티브가 책 대화방 별점과 개인 별점 도서 목록을 분리해 식별하는 Query Key를 제공한다. */
export const bookRatingKeys = {
  /** 책 대화방 식별자로 별점 현황 query key를 생성한다. */
  byChat: (bookChatId: string) => ['book-ratings', bookChatId] as const,
  /** 프로필 식별자로 개인 별점 도서 query key를 생성한다. */
  myBooks: (profileId: string) => ['my-rated-books', profileId] as const,
}

/** 외부 입력을 검증해 개인 별점 도서 목록 도메인 모델로 변환한다. */
export function parseRatedBooks(value: unknown): RatedBook[] {
  return z.array(ratedBookRowSchema).parse(value).map(mapRatedBook)
}

/** 외부 입력을 검증해 책 대화방 별점 현황 도메인 모델로 변환한다. */
export function parseBookChatRatings(value: unknown, currentProfileId: string): BookChatRating[] {
  const profileId = z.string().uuid().parse(currentProfileId)
  return z
    .array(bookChatRatingRowSchema)
    .parse(value)
    .map((row) => mapBookChatRating(row, profileId))
}

/** 외부 입력을 검증해 별점 저장 요청 형식으로 변환한다. */
export function parseBookRatingInput(value: unknown): BookRatingInput {
  return bookRatingInputSchema.parse(value)
}

/** 별점 목록의 평균을 소수 첫째 자리로 반올림해 반환하고, 기록이 없으면 null을 반환한다. */
export function calculateAverageRating(ratings: Pick<BookChatRating, 'rating'>[]): number | null {
  if (ratings.length === 0) return null
  const total = ratings.reduce((sum, item) => sum + item.rating, 0)
  return Math.round((total / ratings.length) * 10) / 10
}

/** 원본 데이터를 개인 별점 도서 도메인 모델로 변환한다. */
function mapRatedBook(row: z.infer<typeof ratedBookRowSchema>): RatedBook {
  return {
    authors: row.book_chats.books.authors,
    bookChatId: row.book_chat_id,
    rating: row.rating,
    review: row.review,
    roomId: row.book_chats.room_id,
    thumbnailUrl: row.book_chats.books.thumbnail_url,
    title: row.book_chats.books.title,
    updatedAt: row.updated_at,
  }
}

/** 원본 데이터를 책 대화방 별점 현황 도메인 모델로 변환한다. */
function mapBookChatRating(
  row: z.infer<typeof bookChatRatingRowSchema>,
  currentProfileId: string,
): BookChatRating {
  const member = row.book_chats.room_members.find(
    (roomMember) => roomMember.profile_id === row.profile_id,
  )

  return {
    avatarPath: member?.room_avatar_path ?? row.profiles.avatar_path,
    displayName: member?.room_display_name ?? row.profiles.display_name,
    isMe: row.profile_id === currentProfileId,
    profileId: row.profile_id,
    rating: row.rating,
    review: row.review,
    updatedAt: row.updated_at,
  }
}
