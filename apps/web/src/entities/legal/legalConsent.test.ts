import { describe, expect, it } from 'vitest'

import { legalDocumentVersion } from './legalDocument'
import { hasRequiredLegalConsent } from './legalConsent'

describe('hasRequiredLegalConsent', () => {
  it('returns false when either required document is missing', () => {
    expect(
      hasRequiredLegalConsent([{ document_type: 'terms', document_version: legalDocumentVersion }]),
    ).toBe(false)
  })

  it('returns true only when both current documents have been recorded', () => {
    expect(
      hasRequiredLegalConsent([
        { document_type: 'terms', document_version: legalDocumentVersion },
        { document_type: 'privacy', document_version: legalDocumentVersion },
      ]),
    ).toBe(true)
  })

  it('requires consent again for a user who accepted only the previous 2026-07-18.2 documents', () => {
    expect(
      hasRequiredLegalConsent([
        { document_type: 'terms', document_version: '2026-07-18.2' },
        { document_type: 'privacy', document_version: '2026-07-18.2' },
      ]),
    ).toBe(false)
  })
})
