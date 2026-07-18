import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

const bookChatRowSchema = z.object({
  books: z
    .object({
      authors: z.array(z.string()),
      thumbnail_url: z.string().nullable(),
      title: z.string(),
    })
    .nullable(),
  id: z.string().uuid(),
  name: z.string(),
})

const bookSearchItemSchema = z.object({
  authors: z.array(z.string()),
  externalUrl: z.string().url().nullable(),
  isbn10: z.string().nullable(),
  isbn13: z.string().nullable(),
  publishedAt: z.string().nullable(),
  publisher: z.string().nullable(),
  source: z.literal('kakao'),
  thumbnailUrl: z.string().url().nullable(),
  title: z.string(),
})

const bookSearchResponseSchema = z.object({
  data: z.object({ items: z.array(bookSearchItemSchema) }),
  ok: z.literal(true),
  requestId: z.string(),
})

const bookChatResultSchema = z.array(z.object({ book_chat_id: z.string().uuid() })).length(1)
const roomSchema = z.object({
  description: z.string().nullable(),
  id: z.string().uuid(),
  name: z.string(),
})

const managedBookChatSchema = z.object({
  books: z.object({ thumbnail_url: z.string().nullable(), title: z.string() }).nullable(),
  id: z.string().uuid(),
  name: z.string().min(1),
  room_id: z.string().uuid(),
  status: z.enum(['reading', 'completed', 'archived', 'deleted']),
})

export type BookChat = {
  authors: string[]
  id: string
  name: string
  thumbnailUrl: string | null
  title: string
}

export type BookSearchItem = z.infer<typeof bookSearchItemSchema>
export type ReadingRoomDetail = z.infer<typeof roomSchema>
export type ManagedBookChat = {
  id: string
  name: string
  roomId: string
  status: 'reading' | 'completed' | 'archived' | 'deleted'
  thumbnailUrl: string | null
  title: string
}

export const bookChatKeys = {
  /** 독서방 식별자로 안정적인 query key를 생성한다. */
  byRoom: (roomId: string) => ['book-chats', roomId] as const,
  /** 독서방 식별자로 독서방 상세 query key를 생성한다. */
  room: (roomId: string) => ['reading-room', roomId] as const,
}

/** 책 대화방 목록 데이터를 조회하거나 계산해 반환한다. */
export async function getBookChats(client: SupabaseClient, roomId: string): Promise<BookChat[]> {
  const response = await client
    .from('book_chats')
    .select('id, name, books(title, authors, thumbnail_url)')
    .eq('room_id', roomId)
    .eq('status', 'reading')
    .order('created_at', { ascending: false })

  if (response.error) throw response.error

  return parseBookChats(response.data)
}

/** 독서방 데이터를 조회하거나 계산해 반환한다. */
export async function getReadingRoom(
  client: SupabaseClient,
  roomId: string,
): Promise<ReadingRoomDetail | null> {
  const response = await client
    .from('reading_rooms')
    .select('id, name, description')
    .eq('id', roomId)
    .maybeSingle()

  if (response.error) throw response.error
  return response.data ? roomSchema.parse(response.data) : null
}

/** 관리 화면용 책 대화방 상태와 책 정보를 조회한다. */
export async function getManagedBookChat(
  client: SupabaseClient,
  bookChatId: string,
): Promise<ManagedBookChat | null> {
  const response = await client
    .from('book_chats')
    .select('id, name, room_id, status, books(title, thumbnail_url)')
    .eq('id', bookChatId)
    .maybeSingle()

  if (response.error) throw response.error
  if (response.data === null) return null

  return mapManagedBookChat(managedBookChatSchema.parse(response.data))
}

/** 대화방의 읽기 상태를 완독 또는 아카이브 상태로 바꾼다. */
export async function updateBookChatStatus(
  client: SupabaseClient,
  bookChatId: string,
  status: 'reading' | 'completed' | 'archived',
): Promise<void> {
  const response = await client.rpc('set_book_chat_status', {
    p_book_chat_id: z.string().uuid().parse(bookChatId),
    p_status: status,
  })

  if (response.error) throw response.error
}

/** 확인 문구가 일치할 때 책 대화방과 연결된 영상 삭제 작업을 요청한다. */
export async function deleteManagedBookChat(
  client: SupabaseClient,
  bookChatId: string,
  confirmationName: string,
): Promise<void> {
  const response = await client.rpc('delete_book_chat', {
    p_book_chat_id: z.string().uuid().parse(bookChatId),
    p_confirmation_name: z.string().trim().min(1).max(120).parse(confirmationName),
  })

  if (response.error) throw response.error
}

/** 검색어로 책 목록을 조회해 반환한다. */
export async function searchBooks(
  client: SupabaseClient,
  query: string,
): Promise<BookSearchItem[]> {
  const response = await client.functions.invoke('book-search', { body: { query, size: 10 } })
  if (response.error) throw response.error

  return parseBookSearchResponse(response.data)
}

/** 책 대화방 데이터를 생성해 반환한다. */
export async function createBookChat(
  client: SupabaseClient,
  roomId: string,
  book: BookSearchItem,
): Promise<string> {
  const response = await client.rpc('create_book_chat', {
    p_authors: book.authors,
    p_external_url: book.externalUrl,
    p_isbn10: book.isbn10,
    p_isbn13: book.isbn13,
    p_name: book.title,
    p_published_at: book.publishedAt,
    p_publisher: book.publisher,
    p_room_id: roomId,
    p_source: book.source,
    p_thumbnail_url: book.thumbnailUrl,
    p_title: book.title,
  })

  if (response.error) throw response.error

  const [result] = bookChatResultSchema.parse(response.data)
  if (!result) throw new Error('Book chat creation returned no result')

  return result.book_chat_id
}

/** 원본 데이터를 책 대화방 도메인 모델로 변환한다. */
function mapBookChat(row: z.infer<typeof bookChatRowSchema>): BookChat[] {
  if (!row.books) return []

  return [
    {
      authors: row.books.authors,
      id: row.id,
      name: row.name,
      thumbnailUrl: row.books.thumbnail_url,
      title: row.books.title,
    },
  ]
}

/** 원본 관리 행을 화면에서 쓰는 책 대화 모델로 변환한다. */
function mapManagedBookChat(row: z.infer<typeof managedBookChatSchema>): ManagedBookChat {
  return {
    id: row.id,
    name: row.name,
    roomId: row.room_id,
    status: row.status,
    thumbnailUrl: row.books?.thumbnail_url ?? null,
    title: row.books?.title ?? row.name,
  }
}

/** 외부 입력을 검증해 책 대화방 목록 형식으로 변환한다. */
export function parseBookChats(value: unknown): BookChat[] {
  return z.array(bookChatRowSchema).parse(value).flatMap(mapBookChat)
}

/** 외부 입력을 검증해 책 검색 응답 형식으로 변환한다. */
export function parseBookSearchResponse(value: unknown): BookSearchItem[] {
  return bookSearchResponseSchema.parse(value).data.items
}
