import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'

import { LegalDocumentPage } from './LegalDocumentPage'

describe('LegalDocumentPage', () => {
  afterEach(cleanup)

  it('shows the privacy document with the user-facing provider roles', () => {
    renderLegalDocument('/legal/privacy')

    expect(screen.getByRole('heading', { name: 'Talk후감 개인정보처리방침' })).toBeInTheDocument()
    expect(screen.getByText(/Supabase는 계정 인증/)).toBeInTheDocument()
    expect(screen.getByText(/Mux는 이용자가 올린 영상/)).toBeInTheDocument()
  })

  it('shows a recovery action for an unknown document link', () => {
    renderLegalDocument('/legal/unknown')

    expect(screen.getByText('요청한 정책 문서를 찾지 못했어요.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '로그인으로 돌아가기' })).toHaveAttribute('href', '/')
  })
})

/** 정책 문서 라우트를 메모리 라우터 환경에서 렌더링한다. */
function renderLegalDocument(initialEntry: string) {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/legal/:documentId" element={<LegalDocumentPage />} />
      </Routes>
    </MemoryRouter>,
  )
}
