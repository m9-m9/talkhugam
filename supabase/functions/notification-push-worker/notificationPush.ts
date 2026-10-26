import { z } from 'npm:zod@4.4.3'

const jobSchema = z.object({
  attempts: z.number().int().min(1).max(5), book_chat_id: z.uuid().nullable(), id: z.uuid(),
  notification_id: z.uuid(), recipient_profile_id: z.uuid(), room_id: z.uuid().nullable(),
  type: z.enum(['reply', 'mention', 'invite', 'invite_request']),
})
export type NotificationPushJob = z.infer<typeof jobSchema>

/** Worker가 받은 DB 작업 행을 검증해 안전한 푸시 작업 모델로 반환한다. */
export function parseNotificationPushJobs(input: unknown): NotificationPushJob[] {
  return z.array(jobSchema).parse(input)
}

/** 알림의 검증된 식별자만 사용해 앱 내부 이동 경로를 만든다. */
export function createNotificationPushTarget(job: NotificationPushJob): string | null {
  if (job.room_id === null) return null
  if (job.type === 'invite_request') return '/rooms/' + job.room_id + '/manage'
  if (job.book_chat_id !== null) return '/rooms/' + job.room_id + '/books/' + job.book_chat_id
  return '/rooms/' + job.room_id
}

/** Expo 응답을 재시도 가능 여부와 해제 대상 여부로 축약한다. */
export function classifyExpoPushResponse(response: Response): 'sent' | 'retry' | 'invalid' {
  if (!response.ok) return response.status >= 500 || response.status === 429 ? 'retry' : 'invalid'
  return 'sent'
}

/** Expo ticket 오류가 더 이상 쓸 수 없는 기기 토큰을 뜻하는지 확인한다. */
export function isDeviceNotRegistered(input: unknown): boolean {
  return z.object({ data: z.array(z.object({ details: z.object({ error: z.string() }).optional() })) })
    .safeParse(input).data?.data.some((ticket) => ticket.details?.error === 'DeviceNotRegistered') ?? false
}
