import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthCallbackPage } from './AuthCallbackPage'

const { getOnboardingCompletedAt, getUser } = vi.hoisted(() => ({
  getOnboardingCompletedAt: vi.fn(),
  getUser: vi.fn(),
}))

vi.mock('../../entities/profile', () => ({ getOnboardingCompletedAt }))
vi.mock('../../shared/api/supabaseClient', () => ({
  createSupabaseClient: () => ({ auth: { getUser } }),
}))

describe('AuthCallbackPage', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(cleanup)

  it('shows the provider error without requesting a user again', async () => {
    renderCallback('/auth/callback?auth_error=provider_failed')

    expect(
      await screen.findByText('로그인이 취소되었거나 만료되었어요. 다시 시도해 주세요.'),
    ).toBeInTheDocument()
    expect(getUser).not.toHaveBeenCalled()
  })

  it('uses the book loader while the login session is being checked', () => {
    getUser.mockReturnValue(new Promise(() => undefined))

    renderCallback('/auth/callback')

    const status = screen.getByRole('status', { name: '로그인 정보를 확인하고 있어요.' })
    expect(status.querySelector('.talkhugam-book-loader')).toBeInTheDocument()
  })

  it('sends a completed profile to the room list', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    getOnboardingCompletedAt.mockResolvedValue('2026-07-17T00:00:00.000Z')

    renderCallback('/auth/callback')

    expect(await screen.findByText('독서방 목록')).toBeInTheDocument()
  })
})

function renderCallback(initialEntry: string) {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/rooms" element={<p>독서방 목록</p>} />
      </Routes>
    </MemoryRouter>,
  )
}
