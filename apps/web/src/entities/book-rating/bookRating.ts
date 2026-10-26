import type { SupabaseClient } from '@supabase/supabase-js'
import {
  bookRatingKeys,
  calculateAverageRating,
  parseBookChatRatings,
  parseBookRatingInput,
  parseRatedBooks,
  type BookChatRating,
  type BookRatingInput,
  type RatedBook,
} from '@talkhugam/domain'
import { z } from 'zod'

export {
  bookRatingKeys,
  calculateAverageRating,
  parseBookChatRatings,
  parseBookRatingInput,
  parseRatedBooks,
}
export type { BookChatRating, BookRatingInput, RatedBook }

/** 개인이 별점을 남긴 도서 목록 데이터를 최근 수정순으로 조회해 반환한다. */
export async function getMyRatedBooks(
  client: SupabaseClient,
  profileId: string,
): Promise<RatedBook[]> {
  const response = await client
    .from('book_chat_ratings')
    .select(
      'book_chat_id, rating, review, updated_at, book_chats!inner(room_id, books!inner(title, authors, thumbnail_url))',
    )
    .eq('profile_id', profileId)
    .order('updated_at', { ascending: false })

  if (response.error) throw response.error
  return parseRatedBooks(response.data)
}

/** 책 대화방 멤버의 별점 현황 데이터를 조회해 반환한다. */
export async function getBookChatRatings(
  client: SupabaseClient,
  bookChatId: string,
  currentProfileId: string,
): Promise<BookChatRating[]> {
  const response = await client
    .from('book_chat_ratings')
    .select(
      'profile_id, rating, review, updated_at, profiles(display_name, avatar_path), book_chats!inner(room_members(profile_id, room_display_name, room_avatar_path))',
    )
    .eq('book_chat_id', bookChatId)
    .order('updated_at', { ascending: true })

  if (response.error) throw response.error
  return parseBookChatRatings(response.data, currentProfileId)
}

/** 개인의 별점과 선택 총평을 저장한다. */
export async function upsertBookChatRating(
  client: SupabaseClient,
  input: BookRatingInput,
): Promise<void> {
  const values = parseBookRatingInput(input)
  const response = await client.rpc('upsert_book_chat_rating', {
    p_book_chat_id: values.bookChatId,
    p_rating: values.rating,
    p_review: values.review,
  })

  if (response.error) throw response.error
}

/** 현재 사용자의 책 대화방 별점 기록을 삭제한다. */
export async function removeBookChatRating(
  client: SupabaseClient,
  bookChatId: string,
): Promise<void> {
  const response = await client.rpc('remove_book_chat_rating', {
    p_book_chat_id: z.string().uuid().parse(bookChatId),
  })

  if (response.error) throw response.error
}
