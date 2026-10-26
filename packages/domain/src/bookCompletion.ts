import { z } from 'zod'

export const completedBookRowSchema = z.object({
  book_chat_id: z.string().uuid(),
  book_chats: z.object({
    books: z.object({
      authors: z.array(z.string()),
      thumbnail_url: z.string().url().nullable(),
      title: z.string(),
    }),
    room_id: z.string().uuid(),
  }),
  completed_at: z.string().datetime({ offset: true }),
  rating: z.number().int().min(1).max(5).nullable(),
  review: z.string().nullable(),
})

export const bookChatCompletionRowSchema = z.object({
  book_chats: z.object({
    room_members: z.array(
      z.object({
        profile_id: z.string().uuid(),
        room_avatar_path: z.string().nullable(),
        room_display_name: z.string(),
      }),
    ),
  }),
  completed_at: z.string().datetime({ offset: true }),
  profile_id: z.string().uuid(),
  profiles: z.object({
    avatar_path: z.string().nullable(),
    display_name: z.string(),
  }),
  rating: z.number().int().min(1).max(5).nullable(),
  review: z.string().nullable(),
})

export const bookCompletionInputSchema = z.object({
  bookChatId: z.string().uuid(),
  rating: z.number().int().min(1).max(5).nullable(),
  review: z.string().trim().max(1000).nullable(),
})

export const bookChatCompletionIdRowSchema = z.object({ book_chat_id: z.string().uuid() })

export type BookChatCompletion = {
  avatarPath: string | null
  completedAt: string
  displayName: string
  isMe: boolean
  profileId: string
  rating: number | null
  review: string | null
}

export type BookCompletionInput = z.infer<typeof bookCompletionInputSchema>

export type CompletedBook = {
  authors: string[]
  bookChatId: string
  completedAt: string
  rating: number | null
  review: string | null
  roomId: string
  thumbnailUrl: string | null
  title: string
}

/** 웹과 네이티브가 완독 현황과 개인 도서 목록을 분리해 식별하는 Query Key를 제공한다. */
export const bookCompletionKeys = {
  /** 책 대화방 식별자로 완독 현황 query key를 생성한다. */
  byChat: (bookChatId: string) => ['book-completions', bookChatId] as const,
  /** 프로필 식별자로 개인 완독 도서 query key를 생성한다. */
  myBooks: (profileId: string) => ['my-completed-books', profileId] as const,
  /** 프로필 식별자로 완독 표시용 책 대화 식별자 query key를 생성한다. */
  myBookChatIds: (profileId: string) => ['my-completion-book-chat-ids', profileId] as const,
}

/** 외부 입력을 검증해 개인 완독 도서 목록 도메인 모델로 변환한다. */
export function parseCompletedBooks(value: unknown): CompletedBook[] {
  return z.array(completedBookRowSchema).parse(value).map(mapCompletedBook)
}

/** 외부 입력을 검증해 완독 표시용 책 대화 식별자 목록으로 변환한다. */
export function parseBookChatCompletionIds(value: unknown): string[] {
  return z
    .array(bookChatCompletionIdRowSchema)
    .parse(value)
    .map((row) => row.book_chat_id)
}

/** 외부 입력을 검증해 책 대화방 완독 현황 도메인 모델로 변환한다. */
export function parseBookChatCompletions(
  value: unknown,
  currentProfileId: string,
): BookChatCompletion[] {
  const profileId = z.string().uuid().parse(currentProfileId)
  return z
    .array(bookChatCompletionRowSchema)
    .parse(value)
    .map((row) => mapBookChatCompletion(row, profileId))
}

/** 외부 입력을 검증해 완독 저장 요청 형식으로 변환한다. */
export function parseBookCompletionInput(value: unknown): BookCompletionInput {
  return bookCompletionInputSchema.parse(value)
}

/** 원본 데이터를 개인 완독 도서 도메인 모델로 변환한다. */
function mapCompletedBook(row: z.infer<typeof completedBookRowSchema>): CompletedBook {
  return {
    authors: row.book_chats.books.authors,
    bookChatId: row.book_chat_id,
    completedAt: row.completed_at,
    rating: row.rating,
    review: row.review,
    roomId: row.book_chats.room_id,
    thumbnailUrl: row.book_chats.books.thumbnail_url,
    title: row.book_chats.books.title,
  }
}

/** 원본 데이터를 책 대화방 완독 현황 도메인 모델로 변환한다. */
function mapBookChatCompletion(
  row: z.infer<typeof bookChatCompletionRowSchema>,
  currentProfileId: string,
): BookChatCompletion {
  const member = row.book_chats.room_members.find(
    (roomMember) => roomMember.profile_id === row.profile_id,
  )

  return {
    avatarPath: member?.room_avatar_path ?? row.profiles.avatar_path,
    completedAt: row.completed_at,
    displayName: member?.room_display_name ?? row.profiles.display_name,
    isMe: row.profile_id === currentProfileId,
    profileId: row.profile_id,
    rating: row.rating,
    review: row.review,
  }
}
