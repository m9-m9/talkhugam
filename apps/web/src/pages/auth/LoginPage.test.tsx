import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
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
    renderLoginPage()

    fireEvent.click(screen.getByRole('button', { name: 'Google로 계속하기' }))

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  })

  it('shows a retryable message when OAuth cannot start', async () => {
    signInWithOAuth.mockResolvedValue({ data: null, error: new Error('oauth') })
    renderLoginPage()

    fireEvent.click(screen.getByRole('button', { name: 'Google로 계속하기' }))

    expect(
      await screen.findByText('로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.'),
    ).toBeInTheDocument()
  })

  it('uses the brand spinner while the provider is opening', () => {
    signInWithOAuth.mockReturnValue(new Promise(() => undefined))
    renderLoginPage()

    fireEvent.click(screen.getByRole('button', { name: 'Google로 계속하기' }))

    const status = screen.getByRole('status', { name: '로그인을 연결하고 있어요.' })
    expect(status.querySelector('.talkhugam-brand-spinner')).toBeInTheDocument()
  })

  it('shows a one-time completion message after account deletion', () => {
    window.history.replaceState({}, '', '/?account=deleted')
    renderLoginPage()

    expect(screen.getByRole('status')).toHaveTextContent(
      '계정 삭제 요청이 완료됐어요. Talk후감에 다시 오고 싶을 때 언제든 로그인해 주세요.',
    )
  })

  it('links the required policy documents below social sign-in', () => {
    renderLoginPage()

    expect(screen.getByRole('link', { name: '이용약관' })).toHaveAttribute('href', '/legal/terms')
    expect(screen.getByRole('link', { name: '개인정보처리방침' })).toHaveAttribute(
      'href',
      '/legal/privacy',
    )
  })

  it('keeps every provider icon in the same fixed slot before its label', () => {
    renderLoginPage()

    for (const provider of ['카카오로 로그인', 'Google로 계속하기', '네이버로 로그인']) {
      const button = screen.getByRole('button', { name: provider })
      expect(button.querySelector('.talkhugam-social-login-button__content')).toBeInTheDocument()
      expect(button.querySelector('.talkhugam-social-login-button__icon')).toBeInTheDocument()
    }
  })

  it('keeps an eight-pixel gap between stacked provider buttons', () => {
    renderLoginPage()

    expect(screen.getByRole('button', { name: '카카오로 로그인' }).parentElement).toHaveClass(
      'gap-2',
    )
  })

  it('groups the login content in a centered readable column', () => {
    renderLoginPage()

    expect(screen.getByRole('main')).toHaveClass('talkhugam-login-page')
    expect(screen.getByRole('region', { name: 'Talk후감 로그인' })).toHaveClass(
      'talkhugam-login-content',
    )
  })
})

/** 로그인 화면을 라우터가 필요한 공개 링크와 함께 렌더링한다. */
function renderLoginPage() {
  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  )
}
