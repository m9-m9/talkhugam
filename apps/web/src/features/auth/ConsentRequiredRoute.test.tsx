import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { authenticatedUserContext } from './authenticatedUser'
import { ConsentRequiredRoute } from './ConsentRequiredRoute'

const { getHasRequiredLegalConsent } = vi.hoisted(() => ({
  getHasRequiredLegalConsent: vi.fn(),
}))

vi.mock('../../entities/legal', () => ({ getHasRequiredLegalConsent }))
vi.mock('../../shared/api/supabaseClient', () => ({ createSupabaseClient: () => ({}) }))

describe('ConsentRequiredRoute', () => {
  beforeEach(() => vi.clearAllMocks())

  it('provides a page heading and book loader while the required-consent check is loading', () => {
    getHasRequiredLegalConsent.mockReturnValue(new Promise(() => undefined))

    renderConsentRequiredRoute()

    expect(
      screen.getByRole('heading', { name: '서비스 이용 동의를 확인하고 있어요.' }),
    ).toBeInTheDocument()
    expect(
      screen
        .getByRole('status', { name: '서비스 이용 동의를 확인하고 있어요.' })
        .querySelector('.talkhugam-book-loader'),
    ).toBeInTheDocument()
  })

  it('redirects a user who has not agreed to the current documents', async () => {
    getHasRequiredLegalConsent.mockResolvedValue(false)

    renderConsentRequiredRoute()

    expect(await screen.findByText('정책 동의 화면')).toBeInTheDocument()
  })

  it('renders the requested service page after required consent is confirmed', async () => {
    getHasRequiredLegalConsent.mockResolvedValue(true)

    renderConsentRequiredRoute()

    expect(await screen.findByText('독서방 화면')).toBeInTheDocument()
  })
})

/** 인증 사용자와 라우트를 갖춘 필수 정책 동의 가드 테스트 화면을 렌더링한다. */
function renderConsentRequiredRoute() {
  render(
    <authenticatedUserContext.Provider
      value={{ appMetadata: {}, email: 'reader@example.com', id: 'profile-1', userMetadata: {} }}
    >
      <MemoryRouter initialEntries={['/rooms']}>
        <Routes>
          <Route element={<ConsentRequiredRoute />}>
            <Route path="/rooms" element={<p>독서방 화면</p>} />
          </Route>
          <Route path="/legal-consent" element={<p>정책 동의 화면</p>} />
        </Routes>
      </MemoryRouter>
    </authenticatedUserContext.Provider>,
  )
}
