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

  it('uses the brand spinner while the provider is opening', () => {
    signInWithOAuth.mockReturnValue(new Promise(() => undefined))
    render(<LoginPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Google로 계속하기' }))

    const status = screen.getByRole('status', { name: '로그인을 연결하고 있어요.' })
    expect(status.querySelector('.talkhugam-brand-spinner')).toBeInTheDocument()
  })

  it('shows a one-time completion message after account deletion', () => {
    window.history.replaceState({}, '', '/?account=deleted')
    render(<LoginPage />)

    expect(screen.getByRole('status')).toHaveTextContent(
      '계정 삭제 요청이 완료됐어요. Talk후감에 다시 오고 싶을 때 언제든 로그인해 주세요.',
    )
  })
})
