import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

const rowSchema = z.object({
  book_chat_id: z.string().uuid().nullable(), created_at: z.string(), id: z.string().uuid(),
  read_at: z.string().nullable(), room_id: z.string().uuid().nullable(),
  type: z.enum(['reply', 'mention', 'invite', 'invite_request', 'post', 'video', 'completion', 'removed', 'ownership_transfer', 'system']),
})
export type MobileNotification = { id: string; isRead: boolean; message: string; targetPath: string | null }
export const mobileNotificationKeys = { all: ['mobile-notifications'] as const }

/** 수신자 RLS가 적용된 알림 행을 모바일 목록 모델로 변환한다. */
function mapNotification(input: unknown): MobileNotification {
  const row = rowSchema.parse(input)
  const messages: Record<typeof row.type, string> = {
    reply: '새 답글이 도착했어요.', mention: '회원님을 멘션했어요.', invite: '책방에 초대했어요.',
    invite_request: '책방 초대를 요청했어요.', post: '새 독후감이 도착했어요.', video: '새 영상 기록이 도착했어요.',
    completion: '새 완독 기록이 도착했어요.', removed: '책방에서 나갔어요.', ownership_transfer: '방장을 넘겨받았어요.', system: '새 알림이 도착했어요.',
  }
  const targetPath = row.room_id === null ? null : row.type === 'invite_request' ? '/rooms/' + row.room_id + '/manage'
    : row.book_chat_id ? '/rooms/' + row.room_id + '/books/' + row.book_chat_id : '/rooms/' + row.room_id
  return { id: row.id, isRead: row.read_at !== null, message: messages[row.type], targetPath }
}

/** 현재 수신자의 앱 내 알림을 최신순으로 조회한다. */
export async function getMobileNotifications(client: SupabaseClient): Promise<MobileNotification[]> {
  const response = await client.from('notifications').select('id,type,read_at,room_id,book_chat_id,created_at').order('created_at', { ascending: false })
  if (response.error) throw response.error
  return z.array(z.unknown()).parse(response.data).map(mapNotification)
}

/** 현재 수신자의 알림 하나만 읽음 처리한다. */
export async function markMobileNotificationRead(client: SupabaseClient, id: string): Promise<void> {
  const response = await client.rpc('mark_notifications_read', { p_notification_ids: [z.string().uuid().parse(id)], p_read_all_before: null })
  if (response.error) throw response.error
}
