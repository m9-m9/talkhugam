import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LoginPage } from './LoginPage'

const { signInWithOAuth } = vi.hoisted(() => ({ signInWithOAuth: vi.fn() }))

vi.mock('../../shared/api/supabaseClient', () => ({
  createSupabaseClient: () => ({ auth: { signInWithOAuth } }),
}))

describe('LoginPage', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(cleanup)

  it('starts Google OAuth with the application callback URL', async () => {
    signInWithOAuth.mockResolvedValue({ data: {}, error: null })
    render(<LoginPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Google로 계속하기' }))

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  })

  it('shows a retryable message when OAuth cannot start', async () => {
    signInWithOAuth.mockResolvedValue({ data: null, error: new Error('oauth') })
    render(<LoginPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Google로 계속하기' }))

    expect(
      await screen.findByText('로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.'),
    ).toBeInTheDocument()
  })
})
