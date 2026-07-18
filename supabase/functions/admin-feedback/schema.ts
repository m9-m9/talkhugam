import { z } from 'npm:zod@4.4.3'

/** 운영함의 목록 조회와 상태 변경 요청을 안전한 두 동작으로 제한한다. */
export const adminFeedbackRequestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('access') }),
  z.object({
    action: z.literal('list'),
    status: z.enum(['unread', 'in_progress', 'completed']).optional(),
  }),
  z.object({
    action: z.literal('update_status'),
    status: z.enum(['unread', 'in_progress', 'completed']),
    ticketId: z.uuid(),
  }),
])
