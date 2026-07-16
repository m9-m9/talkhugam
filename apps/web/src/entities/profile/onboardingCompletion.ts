import { z } from 'zod'

const onboardingCompletedAtSchema = z.string().datetime({ offset: true }).nullable()

export function parseOnboardingCompletedAt(value: unknown): string | null {
  return onboardingCompletedAtSchema.parse(value)
}
