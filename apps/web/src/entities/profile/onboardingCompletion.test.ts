import { describe, expect, it } from 'vitest'

import { parseOnboardingCompletedAt } from './onboardingCompletion'

describe('parseOnboardingCompletedAt', () => {
  it('accepts the UTC offset timestamp returned by Supabase', () => {
    expect(parseOnboardingCompletedAt('2026-07-17T02:01:30.123+00:00')).toBe(
      '2026-07-17T02:01:30.123+00:00',
    )
  })

  it('accepts an incomplete onboarding state', () => {
    expect(parseOnboardingCompletedAt(null)).toBeNull()
  })
})
