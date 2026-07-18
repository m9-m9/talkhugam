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

const archivedBookChatRowSchema = z.object({
  archived_at: z.string().datetime({ offset: true }),
  books: z
    .object({
      authors: z.array(z.string()),
      thumbnail_url: z.string().nullable(),
      title: z.string(),
    })
    .nullable(),
  id: z.string().uuid(),
  name: z.string().min(1),
  room_id: z.string().uuid(),
})

const readingBookRowSchema = z.object({
  books: z
    .object({
      authors: z.array(z.string()),
      thumbnail_url: z.string().nullable(),
      title: z.string(),
    })
    .nullable(),
  id: z.string().uuid(),
  name: z.string().min(1),
  reading_rooms: z.object({ name: z.string().min(1) }).nullable(),
  room_id: z.string().uuid(),
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

export type ArchivedBookChat = {
  archivedAt: string
  authors: string[]
  bookChatId: string
  roomId: string
  thumbnailUrl: string | null
  title: string
}

export type ReadingBook = {
  authors: string[]
  bookChatId: string
  isCompleted: boolean
  roomId: string
  roomName: string
  thumbnailUrl: string | null
  title: string
}

export const bookChatKeys = {
  /** 책방 식별자로 안정적인 query key를 생성한다. */
  byRoom: (roomId: string) => ['book-chats', roomId] as const,
  /** 책방 식별자로 책방 상세 query key를 생성한다. */
  room: (roomId: string) => ['reading-room', roomId] as const,
  /** 프로필별 보관한 책 대화 목록 query key를 생성한다. */
  myArchived: (profileId: string) => ['archived-book-chats', profileId] as const,
  /** 프로필과 개인 완독 상태로 모든 참여 책방의 읽는 책 목록 query key를 생성한다. */
  myReading: (profileId: string, completedBookChatIds: readonly string[]) =>
    ['my-reading-books', profileId, ...completedBookChatIds] as const,
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

/** 책방 데이터를 조회하거나 계산해 반환한다. */
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

/** 현재 사용자가 참여했던 책방에서 보관한 책 대화 목록을 조회한다. */
export async function getMyArchivedBookChats(
  client: SupabaseClient,
  profileId: string,
): Promise<ArchivedBookChat[]> {
  z.string().uuid().parse(profileId)
  const response = await client
    .from('book_chats')
    .select('id, room_id, name, archived_at, books(title, authors, thumbnail_url)')
    .eq('status', 'archived')
    .order('archived_at', { ascending: false })

  if (response.error) throw response.error
  return parseArchivedBookChats(response.data)
}

/** 참여 중인 모든 책방의 읽는 책을 개인 완독 표시와 함께 조회한다. */
export async function getMyReadingBooks(
  client: SupabaseClient,
  profileId: string,
  completedBookChatIds: readonly string[],
): Promise<ReadingBook[]> {
  z.string().uuid().parse(profileId)
  const response = await client
    .from('book_chats')
    .select('id, room_id, name, books(title, authors, thumbnail_url), reading_rooms(name)')
    .eq('status', 'reading')
    .order('created_at', { ascending: false })

  if (response.error) throw response.error
  return parseReadingBooks(response.data, completedBookChatIds)
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
function mapBookChat(row: z.infer<typeof bookChatRowSchema>): BookChat {
  return {
    authors: row.books?.authors ?? [],
    id: row.id,
    name: row.name,
    thumbnailUrl: row.books?.thumbnail_url ?? null,
    title: row.books?.title ?? row.name,
  }
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
  return z.array(bookChatRowSchema).parse(value).map(mapBookChat)
}

/** 외부 응답을 내 정보 화면에서 쓰는 보관한 책 모델로 변환한다. */
export function parseArchivedBookChats(value: unknown): ArchivedBookChat[] {
  return z.array(archivedBookChatRowSchema).parse(value).map(mapArchivedBookChat)
}

/** 외부 입력을 검증해 책방별 개인 읽는 책 목록 모델로 변환한다. */
export function parseReadingBooks(
  value: unknown,
  completedBookChatIds: readonly string[],
): ReadingBook[] {
  const completedIds = new Set(completedBookChatIds)
  return z
    .array(readingBookRowSchema)
    .parse(value)
    .map((row) => mapReadingBook(row, completedIds))
}

/** 원본 데이터를 개인 책 목록에서 쓰는 읽기 상태 모델로 변환한다. */
function mapReadingBook(
  row: z.infer<typeof readingBookRowSchema>,
  completedBookChatIds: ReadonlySet<string>,
): ReadingBook {
  return {
    authors: row.books?.authors ?? [],
    bookChatId: row.id,
    isCompleted: completedBookChatIds.has(row.id),
    roomId: row.room_id,
    roomName: row.reading_rooms?.name ?? '이름 없는 책방',
    thumbnailUrl: row.books?.thumbnail_url ?? null,
    title: row.books?.title ?? row.name,
  }
}

/** 원본 보관한 책 행을 개인 기록 화면의 도메인 모델로 변환한다. */
function mapArchivedBookChat(row: z.infer<typeof archivedBookChatRowSchema>): ArchivedBookChat {
  return {
    archivedAt: row.archived_at,
    authors: row.books?.authors ?? [],
    bookChatId: row.id,
    roomId: row.room_id,
    thumbnailUrl: row.books?.thumbnail_url ?? null,
    title: row.books?.title ?? row.name,
  }
}

/** 외부 입력을 검증해 책 검색 응답 형식으로 변환한다. */
export function parseBookSearchResponse(value: unknown): BookSearchItem[] {
  return bookSearchResponseSchema.parse(value).data.items
}
