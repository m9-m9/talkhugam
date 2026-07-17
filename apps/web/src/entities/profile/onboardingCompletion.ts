import { z } from 'zod'

const onboardingCompletedAtSchema = z.string().datetime({ offset: true }).nullable()

/** 외부 입력을 검증해 온보딩 Completed At 형식으로 변환한다. */
export function parseOnboardingCompletedAt(value: unknown): string | null {
  return onboardingCompletedAtSchema.parse(value)
}
