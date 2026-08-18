import type { SupabaseClient } from '@supabase/supabase-js'
import {
  parseBookChatCompletions,
  parseBookCompletionInput,
  type BookChatCompletion,
  type BookCompletionInput,
} from '@talkhugam/domain'
import { z } from 'zod'

/** 현재 멤버가 볼 수 있는 책 대화의 완독 현황만 시간순으로 읽어 반환한다. */
export async function getMobileBookChatCompletions(
  client: SupabaseClient,
  bookChatId: string,
  currentProfileId: string,
): Promise<BookChatCompletion[]> {
  const response = await client
    .from('book_chat_completions')
    .select(
      'profile_id, completed_at, rating, review, profiles(display_name, avatar_path), book_chats!inner(room_members(profile_id, room_display_name, room_avatar_path))',
    )
    .eq('book_chat_id', z.string().uuid().parse(bookChatId))
    .order('completed_at', { ascending: true })

  if (response.error) throw response.error
  return parseBookChatCompletions(response.data, currentProfileId)
}

/** 검증된 현재 회원의 별점·총평을 좁은 완독 저장 RPC로 전달한다. */
export async function upsertMobileBookChatCompletion(
  client: SupabaseClient,
  input: unknown,
): Promise<void> {
  const values = parseBookCompletionInput(input)
  const response = await client.rpc('upsert_book_chat_completion', {
    p_book_chat_id: values.bookChatId,
    p_rating: values.rating,
    p_review: values.review,
  })

  if (response.error) throw response.error
}

/** 현재 회원의 책 대화 완독 기록만 좁은 삭제 RPC로 제거한다. */
export async function removeMobileBookChatCompletion(
  client: SupabaseClient,
  bookChatId: string,
): Promise<void> {
  const response = await client.rpc('remove_book_chat_completion', {
    p_book_chat_id: z.string().uuid().parse(bookChatId),
  })

  if (response.error) throw response.error
}

export type { BookCompletionInput }
