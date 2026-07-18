import { describe, expect, it } from 'vitest'

import { hasRequiredLegalConsent } from './legalConsent'

describe('hasRequiredLegalConsent', () => {
  it('returns false when either required document is missing', () => {
    expect(
      hasRequiredLegalConsent([{ document_type: 'terms', document_version: '2026-07-18' }]),
    ).toBe(false)
  })

  it('returns true only when both current documents have been recorded', () => {
    expect(
      hasRequiredLegalConsent([
        { document_type: 'terms', document_version: '2026-07-18' },
        { document_type: 'privacy', document_version: '2026-07-18' },
      ]),
    ).toBe(true)
  })
})
