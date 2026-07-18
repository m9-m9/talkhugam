import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

const completedBookRowSchema = z.object({
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

const bookChatCompletionRowSchema = z.object({
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

const bookCompletionInputSchema = z.object({
  bookChatId: z.string().uuid(),
  rating: z.number().int().min(1).max(5).nullable(),
  review: z.string().trim().max(1000).nullable(),
})

const bookChatCompletionIdRowSchema = z.object({ book_chat_id: z.string().uuid() })

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

export const bookCompletionKeys = {
  /** 책 대화방 식별자로 완독 현황 query key를 생성한다. */
  byChat: (bookChatId: string) => ['book-completions', bookChatId] as const,
  /** 프로필 식별자로 개인 완독 도서 query key를 생성한다. */
  myBooks: (profileId: string) => ['my-completed-books', profileId] as const,
  /** 프로필 식별자로 완독 표시용 책 대화 식별자 query key를 생성한다. */
  myBookChatIds: (profileId: string) => ['my-completion-book-chat-ids', profileId] as const,
}

/** 개인이 완독한 도서 목록 데이터를 조회해 반환한다. */
export async function getMyCompletedBooks(
  client: SupabaseClient,
  profileId: string,
): Promise<CompletedBook[]> {
  const response = await client
    .from('book_chat_completions')
    .select(
      'book_chat_id, completed_at, rating, review, book_chats!inner(room_id, books!inner(title, authors, thumbnail_url))',
    )
    .eq('profile_id', profileId)
    .order('completed_at', { ascending: false })

  if (response.error) throw response.error
  return parseCompletedBooks(response.data)
}

/** 개인이 완독한 책 대화 식별자만 조회해 다른 목록의 완독 표시에 사용한다. */
export async function getMyBookChatCompletionIds(
  client: SupabaseClient,
  profileId: string,
): Promise<string[]> {
  const response = await client
    .from('book_chat_completions')
    .select('book_chat_id')
    .eq('profile_id', z.string().uuid().parse(profileId))

  if (response.error) throw response.error
  return parseBookChatCompletionIds(response.data)
}

/** 책 대화방 멤버의 완독 현황 데이터를 조회해 반환한다. */
export async function getBookChatCompletions(
  client: SupabaseClient,
  bookChatId: string,
  currentProfileId: string,
): Promise<BookChatCompletion[]> {
  const response = await client
    .from('book_chat_completions')
    .select(
      'profile_id, completed_at, rating, review, profiles(display_name, avatar_path), book_chats!inner(room_members(profile_id, room_display_name, room_avatar_path))',
    )
    .eq('book_chat_id', bookChatId)
    .order('completed_at', { ascending: true })

  if (response.error) throw response.error
  return parseBookChatCompletions(response.data, currentProfileId)
}

/** 개인의 완독 여부와 선택 총평을 저장한다. */
export async function upsertBookChatCompletion(
  client: SupabaseClient,
  input: BookCompletionInput,
): Promise<void> {
  const values = parseBookCompletionInput(input)
  const response = await client.rpc('upsert_book_chat_completion', {
    p_book_chat_id: values.bookChatId,
    p_rating: values.rating,
    p_review: values.review,
  })

  if (response.error) throw response.error
}

/** 현재 사용자의 책 대화방 완독 기록을 삭제한다. */
export async function removeBookChatCompletion(
  client: SupabaseClient,
  bookChatId: string,
): Promise<void> {
  const response = await client.rpc('remove_book_chat_completion', {
    p_book_chat_id: z.string().uuid().parse(bookChatId),
  })

  if (response.error) throw response.error
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
