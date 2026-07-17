import { describe, expect, it } from 'vitest'

import { resolveAuthDestination } from './resolveAuthDestination'

describe('resolveAuthDestination', () => {
  it('sends a first-run profile to onboarding', () => {
    expect(resolveAuthDestination(null)).toBe('/onboarding')
  })

  it('sends a completed profile to rooms', () => {
    expect(resolveAuthDestination('2026-07-16T00:00:00.000Z')).toBe('/rooms')
  })
})
