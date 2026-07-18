import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import type { FeedbackCategory, FeedbackStatus } from './feedback'

const adminAccessResponseSchema = z.object({
  data: z.object({ isAdmin: z.literal(true) }),
  ok: z.literal(true),
  requestId: z.string(),
})

const feedbackTicketSchema = z.object({
  authorEmailSnapshot: z.string().min(3).max(320),
  authorProfileId: z.string().uuid(),
  body: z.string().min(1).max(2000),
  category: z.enum(['issue', 'feature', 'other']),
  createdAt: z.string().datetime({ offset: true }),
  handledAt: z.string().datetime({ offset: true }).nullable(),
  handledByProfileId: z.string().uuid().nullable(),
  id: z.string().uuid(),
  status: z.enum(['unread', 'in_progress', 'completed']),
})

const feedbackTicketListResponseSchema = z.object({
  data: z.object({ tickets: z.array(feedbackTicketSchema) }),
  ok: z.literal(true),
  requestId: z.string(),
})

const feedbackTicketUpdateResponseSchema = z.object({
  data: z.object({ ticket: feedbackTicketSchema }),
  ok: z.literal(true),
  requestId: z.string(),
})

export type AdminFeedbackTicket = z.infer<typeof feedbackTicketSchema>

/** 현재 세션이 운영함 접근 허용 목록에 있는지 Edge Function에서 확인한다. */
export async function getAdminAccess(client: SupabaseClient): Promise<boolean> {
  const response = await client.functions.invoke('admin-feedback', { body: { action: 'access' } })
  if (response.error) return false
  return adminAccessResponseSchema.safeParse(response.data).success
}

/** 선택한 상태의 운영함 피드백 티켓을 최신 순서로 조회한다. */
export async function getAdminFeedbackTickets(
  client: SupabaseClient,
  status?: FeedbackStatus,
): Promise<AdminFeedbackTicket[]> {
  const response = await client.functions.invoke('admin-feedback', {
    body: { action: 'list', status },
  })
  if (response.error) throw response.error
  return feedbackTicketListResponseSchema.parse(response.data).data.tickets
}

/** 운영자가 선택한 티켓의 처리 상태를 저장하고 변경된 티켓을 반환한다. */
export async function updateAdminFeedbackStatus(
  client: SupabaseClient,
  ticketId: string,
  status: FeedbackStatus,
): Promise<AdminFeedbackTicket> {
  const response = await client.functions.invoke('admin-feedback', {
    body: { action: 'update_status', status, ticketId },
  })
  if (response.error) throw response.error
  return feedbackTicketUpdateResponseSchema.parse(response.data).data.ticket
}

/** 피드백 유형 코드를 운영함에서 읽기 쉬운 한글 문구로 반환한다. */
export function formatFeedbackCategory(category: FeedbackCategory): string {
  if (category === 'issue') return '불편한 점'
  if (category === 'feature') return '기능 제안'
  return '기타'
}
