import type { SupabaseClient } from '@supabase/supabase-js'
import {
  managedBookChatRowSchema,
  mapManagedBookChat,
  parseBookChats,
  readingRoomDetailSchema,
  type BookChat,
  type ManagedBookChat,
  type ReadingRoomDetail,
} from '@talkhugam/domain'
import { z } from 'zod'

/** 현재 회원에게 RLS로 노출된 단일 책방만 상세 모델로 읽어 반환한다. */
export async function getMobileReadingRoomDetail(
  client: SupabaseClient,
  roomId: string,
): Promise<ReadingRoomDetail | null> {
  const response = await client
    .from('reading_rooms')
    .select('id, name, description')
    .eq('id', z.string().uuid().parse(roomId))
    .maybeSingle()

  if (response.error) throw response.error
  if (response.data === null) return null
  return readingRoomDetailSchema.parse(response.data)
}

/** 현재 회원이 읽을 수 있는 책방의 진행 중인 책 대화만 반환한다. */
export async function getMobileBookChats(client: SupabaseClient, roomId: string): Promise<BookChat[]> {
  const response = await client
    .from('book_chats')
    .select('id, name, books(title, authors, thumbnail_url)')
    .eq('room_id', z.string().uuid().parse(roomId))
    .eq('status', 'reading')
    .order('created_at', { ascending: false })

  if (response.error) throw response.error
  return parseBookChats(response.data)
}

/** 경로의 책방에 실제로 속하고 RLS로 보이는 책 대화만 상세 화면용 모델로 반환한다. */
export async function getMobileDiscussionBookChat(
  client: SupabaseClient,
  roomId: string,
  bookChatId: string,
): Promise<ManagedBookChat | null> {
  const response = await client
    .from('book_chats')
    .select('id, name, room_id, status, books(title, thumbnail_url)')
    .eq('id', z.string().uuid().parse(bookChatId))
    .eq('room_id', z.string().uuid().parse(roomId))
    .maybeSingle()

  if (response.error) throw response.error
  if (response.data === null) return null
  return mapManagedBookChat(managedBookChatRowSchema.parse(response.data))
}
