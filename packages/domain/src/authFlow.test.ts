import { describe, expect, it } from 'vitest'

import {
  hasRequiredLegalConsent,
  legalDocumentVersion,
  parseOnboardingStatus,
  parseLegalConsentRecords,
  resolveAuthDestination,
} from './authFlow'

describe('authentication flow domain', () => {
  it('accepts consent only when every current required document has been recorded', () => {
    expect(
      hasRequiredLegalConsent([
        { document_type: 'terms', document_version: legalDocumentVersion },
        { document_type: 'privacy', document_version: legalDocumentVersion },
      ]),
    ).toBe(true)
  })

  it('rejects consent recorded only for the previous 2026-07-18.2 version', () => {
    expect(
      hasRequiredLegalConsent([
        { document_type: 'terms', document_version: '2026-07-18.2' },
        { document_type: 'privacy', document_version: '2026-07-18.2' },
      ]),
    ).toBe(false)
  })

  it('rejects malformed consent records before they are used for an access decision', () => {
    expect(() =>
      parseLegalConsentRecords([{ document_type: 'unknown', document_version: '' }]),
    ).toThrow()
  })

  it('sends a user without required consent to the consent screen before onboarding', () => {
    expect(resolveAuthDestination(null, false)).toBe('/legal-consent')
  })

  it('sends a consented user to onboarding only until the profile is completed', () => {
    expect(resolveAuthDestination(null, true)).toBe('/onboarding')
    expect(resolveAuthDestination('2026-07-16T00:00:00.000Z', true)).toBe('/rooms')
  })

  it('rejects an invalid onboarding timestamp before routing a signed-in user', () => {
    expect(() => parseOnboardingStatus({ onboarding_completed_at: 'not-a-timestamp' })).toThrow()
  })
})
