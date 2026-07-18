import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

const feedbackCategorySchema = z.enum(['issue', 'feature', 'other'])

const feedbackSubmissionSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  category: feedbackCategorySchema,
})

const feedbackSubmissionResponseSchema = z.object({
  data: z.object({ ticketId: z.string().uuid() }),
  ok: z.literal(true),
  requestId: z.string(),
})

export type FeedbackCategory = z.infer<typeof feedbackCategorySchema>
export type FeedbackStatus = 'unread' | 'in_progress' | 'completed'
export type FeedbackSubmission = z.infer<typeof feedbackSubmissionSchema>

const feedbackStatusLabels: Record<FeedbackStatus, string> = {
  completed: '완료',
  in_progress: '처리 중',
  unread: '미확인',
}

/** 외부 입력을 검증해 제출 가능한 피드백 형식으로 변환한다. */
export function parseFeedbackSubmission(value: unknown): FeedbackSubmission {
  return feedbackSubmissionSchema.parse(value)
}

/** 운영자가 선택한 피드백 상태를 화면에 표시할 한글 문구로 반환한다. */
export function formatFeedbackStatus(status: FeedbackStatus): string {
  return feedbackStatusLabels[status]
}

/** 현재 상태에서 운영자가 다음 상태로 변경할 수 있는지 반환한다. */
export function canTransitionFeedbackStatus(
  currentStatus: FeedbackStatus,
  nextStatus: FeedbackStatus,
): boolean {
  if (currentStatus === nextStatus) return true
  if (currentStatus === 'unread') return nextStatus === 'in_progress' || nextStatus === 'completed'
  if (currentStatus === 'in_progress') return nextStatus === 'unread' || nextStatus === 'completed'
  return nextStatus === 'in_progress'
}

/** 검증된 이용자 의견을 Edge Function에 제출하고 생성된 티켓 식별자를 반환한다. */
export async function submitFeedback(client: SupabaseClient, input: unknown): Promise<string> {
  const values = parseFeedbackSubmission(input)
  const response = await client.functions.invoke('feedback-submit', { body: values })
  if (response.error) throw response.error
  return feedbackSubmissionResponseSchema.parse(response.data).data.ticketId
}
