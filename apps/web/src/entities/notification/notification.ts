import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

const notificationTypeSchema = z.enum([
  'reply',
  'mention',
  'post',
  'video',
  'completion',
  'invite',
  'removed',
  'ownership_transfer',
  'system',
])

const notificationRowSchema = z.object({
  actor: z.object({ room_display_name: z.string().min(1).max(30) }).nullable(),
  book_chat_id: z.string().uuid().nullable().optional(),
  created_at: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
  post: z.object({ book_chat_id: z.string().uuid() }).nullable(),
  post_id: z.string().uuid().nullable(),
  read_at: z.string().datetime({ offset: true }).nullable(),
  room: z.object({ name: z.string().min(1).max(40) }).nullable(),
  room_id: z.string().uuid().nullable(),
  type: notificationTypeSchema,
})

const notificationReadRequestSchema = z.union([
  z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }),
  z.object({ readAllBefore: z.string().datetime({ offset: true }) }),
])

export type AppNotification = {
  actorName: string | null
  createdAt: string
  id: string
  isRead: boolean
  message: string
  roomName: string | null
  targetPath: string | null
  type: z.infer<typeof notificationTypeSchema>
}

export type NotificationReadRequest = z.infer<typeof notificationReadRequestSchema>

export const notificationKeys = {
  /** 알림 목록의 서버 상태를 식별할 query key를 반환한다. */
  all: ['notifications'] as const,
  /** 읽지 않은 알림 수 서버 상태를 식별할 query key를 반환한다. */
  unreadCount: ['notifications', 'unread-count'] as const,
}

/** 현재 사용자가 수신한 알림을 최신순 화면 모델로 조회해 반환한다. */
export async function getNotifications(client: SupabaseClient): Promise<AppNotification[]> {
  const response = await client
    .from('notifications')
    .select(
      'id,type,read_at,created_at,room_id,post_id,book_chat_id,actor:room_members!notifications_actor_member_id_fkey(room_display_name),room:reading_rooms!notifications_room_id_fkey(name),post:posts!notifications_post_id_fkey(book_chat_id)',
    )
    .order('created_at', { ascending: false })

  if (response.error) throw response.error
  return parseNotifications(response.data)
}

/** 현재 사용자가 읽지 않은 알림의 개수를 조회해 반환한다. */
export async function getUnreadNotificationCount(client: SupabaseClient): Promise<number> {
  const response = await client
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)

  if (response.error) throw response.error
  return response.count ?? 0
}

/** 지정 알림 또는 기준 시각 이전 알림을 현재 사용자 기준으로 읽음 처리한다. */
export async function markNotificationsRead(
  client: SupabaseClient,
  request: NotificationReadRequest,
): Promise<number> {
  const response = await client.rpc(
    'mark_notifications_read',
    createNotificationReadPayload(request),
  )
  if (response.error) throw response.error
  return z.number().int().nonnegative().parse(response.data)
}

/** 외부 조회 결과를 검증해 알림 화면에 사용할 도메인 목록으로 변환한다. */
export function parseNotifications(value: unknown): AppNotification[] {
  return z.array(notificationRowSchema).parse(value).map(mapNotification)
}

/** 읽음 처리 요청을 RPC가 요구하는 상호 배타적 인자 형태로 변환한다. */
export function createNotificationReadPayload(request: NotificationReadRequest) {
  const parsed = notificationReadRequestSchema.parse(request)
  if ('ids' in parsed) {
    return { p_notification_ids: parsed.ids, p_read_all_before: null }
  }

  return { p_notification_ids: null, p_read_all_before: parsed.readAllBefore }
}

/** 알림 원본 행을 화면에서 사용할 이름·메시지·이동 경로 모델로 변환한다. */
function mapNotification(row: z.infer<typeof notificationRowSchema>): AppNotification {
  const actorName = row.actor?.room_display_name ?? null
  return {
    actorName,
    createdAt: row.created_at,
    id: row.id,
    isRead: row.read_at !== null,
    message: createNotificationMessage(row.type, actorName),
    roomName: row.room?.name ?? null,
    targetPath: createNotificationTargetPath(
      row.room === null ? null : row.room_id,
      row.book_chat_id ?? row.post?.book_chat_id ?? null,
    ),
    type: row.type,
  }
}

/** 알림 유형과 발신자 이름을 사용자가 이해할 수 있는 한국어 문구로 변환한다. */
function createNotificationMessage(
  type: z.infer<typeof notificationTypeSchema>,
  actorName: string | null,
): string {
  const actor = actorName ?? '누군가'
  const messages = {
    invite: `${actor}님이 책방에 초대했어요.`,
    mention: `${actor}님이 회원님을 멘션했어요.`,
    post: `${actor}님이 새 독후감을 남겼어요.`,
    video: `${actor}님이 새 영상 기록을 남겼어요.`,
    completion: `${actor}님이 완독 기록을 남겼어요.`,
    ownership_transfer: `${actor}님이 회원님에게 방장을 넘겼어요.`,
    removed: `${actor}님이 회원님을 책방에서 내보냈어요.`,
    reply: `${actor}님이 답글을 남겼어요.`,
    system: '새 알림이 도착했어요.',
  }
  return messages[type]
}

/** 알림에 연결된 방 또는 책 대화의 앱 내 이동 경로를 반환한다. */
function createNotificationTargetPath(
  roomId: string | null,
  bookChatId: string | null,
): string | null {
  if (roomId === null) return null
  if (bookChatId === null) return `/rooms/${roomId}`
  return `/rooms/${roomId}/books/${bookChatId}`
}
