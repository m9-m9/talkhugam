import { describe, expect, it } from 'vitest'

import { getLegalDocument, getRequiredLegalDocuments, legalDocumentVersion } from './legalDocument'

describe('legalDocument', () => {
  it('exposes the two required launch documents with versioned Korean copy', () => {
    const documents = getRequiredLegalDocuments()

    expect(documents.map((document) => document.id)).toEqual(['terms', 'privacy'])
    expect(documents.every((document) => document.version === legalDocumentVersion)).toBe(true)
    expect(documents.every((document) => document.sections.length > 0)).toBe(true)
  })

  it('uses the 2026-10-29.1 version and describes per-book ratings instead of completion records', () => {
    const privacy = getLegalDocument('privacy')
    const privacyText = privacy?.sections.flatMap((section) => section.body).join(' ') ?? ''

    expect(legalDocumentVersion).toBe('2026-10-29.1')
    expect(privacyText).toContain('책별 별점·총평')
    expect(privacyText).not.toContain('완독')
  })

  it('discloses CLOVA OCR processing for photo quotes without storing the photo', () => {
    const privacyText =
      getLegalDocument('privacy')
        ?.sections.flatMap((section) => section.body)
        .join(' ') ?? ''

    expect(privacyText).toContain('NAVER Cloud CLOVA OCR')
    expect(privacyText).toContain('사진과 인식한 글자는 저장하지 않고')
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
