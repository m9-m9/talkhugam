import type { SupabaseClient } from '@supabase/supabase-js'
import {
  parseBookChatRatings,
  parseBookRatingInput,
  type BookChatRating,
  type BookRatingInput,
} from '@talkhugam/domain'
import { z } from 'zod'

/** 현재 멤버가 볼 수 있는 책 대화의 별점 현황만 수정순으로 읽어 반환한다. */
export async function getMobileBookChatRatings(
  client: SupabaseClient,
  bookChatId: string,
  currentProfileId: string,
): Promise<BookChatRating[]> {
  const response = await client
    .from('book_chat_ratings')
    .select(
      'profile_id, rating, review, updated_at, profiles(display_name, avatar_path), book_chats!inner(reading_rooms!inner(room_members(profile_id, room_display_name, room_avatar_path)))',
    )
    .eq('book_chat_id', z.string().uuid().parse(bookChatId))
    .order('updated_at', { ascending: true })

  if (response.error) throw response.error
  return parseBookChatRatings(response.data, currentProfileId)
}

/** 검증된 현재 회원의 별점·총평을 좁은 별점 저장 RPC로 전달한다. */
export async function upsertMobileBookChatRating(
  client: SupabaseClient,
  input: unknown,
): Promise<void> {
  const values = parseBookRatingInput(input)
  const response = await client.rpc('upsert_book_chat_rating', {
    p_book_chat_id: values.bookChatId,
    p_rating: values.rating,
    p_review: values.review,
  })

  if (response.error) throw response.error
}

/** 현재 회원의 책 대화 별점 기록만 좁은 삭제 RPC로 제거한다. */
export async function removeMobileBookChatRating(
  client: SupabaseClient,
  bookChatId: string,
): Promise<void> {
  const response = await client.rpc('remove_book_chat_rating', {
    p_book_chat_id: z.string().uuid().parse(bookChatId),
  })

  if (response.error) throw response.error
}

export type { BookRatingInput }
