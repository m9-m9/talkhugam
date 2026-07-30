import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LegalConsentPage } from './LegalConsentPage'

const { getOnboardingCompletedAt, saveRequiredLegalConsents } = vi.hoisted(() => ({
  getOnboardingCompletedAt: vi.fn(),
  saveRequiredLegalConsents: vi.fn(),
}))

vi.mock('../../entities/legal', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../entities/legal')>()
  return { ...actual, saveRequiredLegalConsents }
})

vi.mock('../../entities/profile', () => ({ getOnboardingCompletedAt }))

vi.mock('../../features/auth', () => ({
  useAuthenticatedUser: () => ({ id: 'profile-1' }),
}))

vi.mock('../../shared/api/supabaseClient', () => ({ createSupabaseClient: () => ({}) }))

describe('LegalConsentPage', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(cleanup)

  it('requires both launch documents before the user can continue', async () => {
    getOnboardingCompletedAt.mockResolvedValue(null)
    saveRequiredLegalConsents.mockResolvedValue(undefined)
    renderLegalConsentPage()

    const submitButton = screen.getByRole('button', { name: '동의하고 계속하기' })
    expect(submitButton).toBeDisabled()

    fireEvent.click(screen.getByRole('checkbox', { name: '이용약관에 동의합니다.' }))
    expect(submitButton).toBeDisabled()

    fireEvent.click(screen.getByRole('checkbox', { name: '개인정보처리방침에 동의합니다.' }))
    fireEvent.click(submitButton)

    await waitFor(() => expect(saveRequiredLegalConsents).toHaveBeenCalledWith({}))
    expect(await screen.findByText('온보딩 화면')).toBeInTheDocument()
  })

  it('keeps the consent choices and continuation action separated by foundation spacing', () => {
    renderLegalConsentPage()

    expect(screen.getByRole('checkbox', { name: '이용약관에 동의합니다.' }).closest('fieldset')).toHaveClass(
      'space-y-6',
    )
    expect(screen.getByRole('button', { name: '동의하고 계속하기' }).parentElement).toHaveClass('mt-8')
  })
})

/** 정책 동의 라우트를 메모리 라우터 환경에서 렌더링한다. */
function renderLegalConsentPage() {
  render(
    <MemoryRouter initialEntries={['/legal-consent']}>
      <Routes>
        <Route path="/legal-consent" element={<LegalConsentPage />} />
        <Route path="/onboarding" element={<p>온보딩 화면</p>} />
        <Route path="/rooms" element={<p>독서방 화면</p>} />
      </Routes>
    </MemoryRouter>,
  )
}
