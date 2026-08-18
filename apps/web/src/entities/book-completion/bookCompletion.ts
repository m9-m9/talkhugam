import type { SupabaseClient } from '@supabase/supabase-js'
import {
  bookCompletionKeys,
  parseBookChatCompletionIds,
  parseBookChatCompletions,
  parseBookCompletionInput,
  parseCompletedBooks,
  type BookChatCompletion,
  type BookCompletionInput,
  type CompletedBook,
} from '@talkhugam/domain'
import { z } from 'zod'

export {
  bookCompletionKeys,
  parseBookChatCompletionIds,
  parseBookChatCompletions,
  parseBookCompletionInput,
  parseCompletedBooks,
}
export type { BookChatCompletion, BookCompletionInput, CompletedBook }

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
