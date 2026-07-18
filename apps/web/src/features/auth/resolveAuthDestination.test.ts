import { describe, expect, it } from 'vitest'

import { resolveAuthDestination } from './resolveAuthDestination'

describe('resolveAuthDestination', () => {
  it('sends a signed-in user without the required legal consent to the consent screen first', () => {
    expect(resolveAuthDestination(null, false)).toBe('/legal-consent')
  })

  it('sends a first-run profile to onboarding', () => {
    expect(resolveAuthDestination(null, true)).toBe('/onboarding')
  })

  it('sends a completed profile to rooms', () => {
    expect(resolveAuthDestination('2026-07-16T00:00:00.000Z', true)).toBe('/rooms')
  })
})
