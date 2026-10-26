import type { SupabaseClient } from '@supabase/supabase-js'
import {
  managedBookChatRowSchema,
  mapManagedBookChat,
  parseArchivedBookChats,
  parseBookChats,
  parseBookSearchResponse,
  parseReadingBooks,
  readingRoomDetailSchema,
  type BookChat,
  type BookSearchItem,
  type ManagedBookChat,
  type ReadingRoomDetail,
  type ArchivedBookChat,
  type ReadingBook,
} from '@talkhugam/domain'
import { z } from 'zod'

export {
  bookChatKeys,
  parseArchivedBookChats,
  parseBookChats,
  parseBookSearchResponse,
  parseReadingBooks,
  type ArchivedBookChat,
  type BookChat,
  type BookSearchItem,
  type ManagedBookChat,
  type ReadingBook,
  type ReadingRoomDetail,
} from '@talkhugam/domain'

const bookChatResultSchema = z.array(z.object({ book_chat_id: z.string().uuid() })).length(1)

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
  return response.data ? readingRoomDetailSchema.parse(response.data) : null
}

/** 관리 화면용 책 대화방 상태와 책 정보를 조회한다. */
export async function getManagedBookChat(
  client: SupabaseClient,
  roomId: string,
  bookChatId: string,
): Promise<ManagedBookChat | null> {
  const parsedRoomId = z.string().uuid().parse(roomId)
  const parsedBookChatId = z.string().uuid().parse(bookChatId)
  const response = await client
    .from('book_chats')
    .select('id, name, room_id, status, books(title, thumbnail_url)')
    .eq('id', parsedBookChatId)
    .eq('room_id', parsedRoomId)
    .maybeSingle()

  if (response.error) throw response.error
  if (response.data === null) return null

  return mapManagedBookChat(managedBookChatRowSchema.parse(response.data))
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
