import { describe, expect, it } from 'vitest'

import { getLegalDocument, getRequiredLegalDocuments } from './legalDocument'

describe('legalDocument', () => {
  it('exposes the two required launch documents with versioned Korean copy', () => {
    const documents = getRequiredLegalDocuments()

    expect(documents.map((document) => document.id)).toEqual(['terms', 'privacy'])
    expect(documents.every((document) => document.version === '2026-07-18.2')).toBe(true)
    expect(documents.every((document) => document.sections.length > 0)).toBe(true)
  })

  it('returns no document for an unknown public route parameter', () => {
    expect(getLegalDocument('unknown')).toBeNull()
  })

  it('describes providers by their user-facing processing role without operational secrets', () => {
    const privacy = getLegalDocument('privacy')

    expect(privacy?.sections.flatMap((section) => section.body).join(' ')).toContain('Mux')
    expect(privacy?.sections.flatMap((section) => section.body).join(' ')).toContain('Supabase')
    expect(privacy?.sections.flatMap((section) => section.body).join(' ')).toContain(
      'Microsoft Clarity',
    )
    expect(privacy?.sections.flatMap((section) => section.body).join(' ')).not.toContain(
      'PRIVATE_KEY',
    )
  })
})
