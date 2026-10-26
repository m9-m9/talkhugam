import type { SupabaseClient } from '@supabase/supabase-js'
import {
  bookSearchItemSchema,
  parseBookSearchResponse,
  type BookSearchItem,
} from '@talkhugam/domain'
import { z } from 'zod'

const roomIdSchema = z.string().uuid()
const bookChatResultSchema = z.array(z.object({ book_chat_id: z.string().uuid() })).length(1)
const bestsellerItemSchema = z.object({
  authors: z.array(z.string()),
  externalUrl: z.string().url().nullable(),
  id: z.string().min(1),
  isbn13: z.string().nullable(),
  publisher: z.string().nullable(),
  thumbnailUrl: z.string().url().nullable(),
  title: z.string().min(1),
})
const bestsellerResponseSchema = z.object({
  data: z.object({ isConfigured: z.boolean(), items: z.array(bestsellerItemSchema) }),
  ok: z.literal(true),
  requestId: z.string().min(1),
})

export const mobileBookSearchQuerySchema = z.string().trim().min(2).max(100)

/** 인증된 Edge Function으로 제목 또는 저자 검색 결과를 검증해 반환한다. */
export async function searchMobileBooks(client: SupabaseClient, query: string): Promise<BookSearchItem[]> {
  const response = await client.functions.invoke('book-search', {
    body: { query: mobileBookSearchQuerySchema.parse(query), size: 10 },
  })
  if (response.error) throw response.error

  return parseBookSearchResponse(response.data)
}

/** 인증된 Edge Function의 베스트셀러를 책 대화 생성에 쓸 도서 모델로 변환한다. */
export async function getMobileBookBestsellers(client: SupabaseClient): Promise<BookSearchItem[]> {
  const response = await client.functions.invoke('book-bestsellers')
  if (response.error) throw response.error

  return bestsellerResponseSchema.parse(response.data).data.items.map(mapBestsellerToBook)
}

/** RLS가 보호하는 RPC로 책과 책 대화를 만들고 검증된 식별자를 반환한다. */
export async function createMobileBookChat(
  client: SupabaseClient,
  roomId: string,
  book: BookSearchItem,
): Promise<string> {
  const parsedRoomId = roomIdSchema.parse(roomId)
  const parsedBook = bookSearchItemSchema.parse(book)
  const response = await client.rpc('create_book_chat', {
    p_authors: parsedBook.authors,
    p_external_url: parsedBook.externalUrl,
    p_isbn10: parsedBook.isbn10,
    p_isbn13: parsedBook.isbn13,
    p_name: parsedBook.title,
    p_published_at: parsedBook.publishedAt,
    p_publisher: parsedBook.publisher,
    p_room_id: parsedRoomId,
    p_source: parsedBook.source,
    p_thumbnail_url: parsedBook.thumbnailUrl,
    p_title: parsedBook.title,
  })
  if (response.error) throw response.error

  const [result] = bookChatResultSchema.parse(response.data)
  return result.book_chat_id
}

/** 베스트셀러 API 항목을 기존 책 대화 생성 계약으로 축소해 변환한다. */
function mapBestsellerToBook(book: z.infer<typeof bestsellerItemSchema>): BookSearchItem {
  return {
    authors: book.authors,
    externalUrl: book.externalUrl,
    isbn10: null,
    isbn13: book.isbn13,
    publishedAt: null,
    publisher: book.publisher,
    source: 'aladin',
    thumbnailUrl: book.thumbnailUrl,
    title: book.title,
  }
}
