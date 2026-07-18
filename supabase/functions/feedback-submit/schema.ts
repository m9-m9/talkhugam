import { z } from 'npm:zod@4.4.3'

/** 이용자가 제출하는 의견의 유형과 본문 길이를 서버 경계에서 검증한다. */
export const feedbackSubmissionSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  category: z.enum(['issue', 'feature', 'other']),
})
