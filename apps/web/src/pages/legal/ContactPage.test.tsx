import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ContactPage } from './ContactPage'

const { getClientEnv } = vi.hoisted(() => ({
  getClientEnv: vi.fn(() => ({ VITE_SUPPORT_EMAIL: 'support@talkhugam.com' })),
}))

vi.mock('../../app/env', () => ({ getClientEnv }))

describe('ContactPage', () => {
  afterEach(cleanup)

  it('groups policies and contact under the service information surface', () => {
    renderServiceInfoPage()

    expect(screen.getByRole('heading', { name: '서비스 정보' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '이용약관' })).toHaveAttribute('href', '/legal/terms')
    expect(screen.getByRole('link', { name: '개인정보처리방침' })).toHaveAttribute(
      'href',
      '/legal/privacy',
    )
    expect(screen.getByRole('link', { name: 'support@talkhugam.com' })).toHaveAttribute(
      'href',
      'mailto:support@talkhugam.com',
    )
  })

  it('keeps the unavailable support copy concise on narrow screens', () => {
    getClientEnv.mockReturnValueOnce({ VITE_SUPPORT_EMAIL: '' })
    renderServiceInfoPage()

    expect(screen.getByText('문의 이메일은 출시 전에 안내됩니다.')).toHaveClass(
      'talkhugam-balanced-copy',
    )
  })
})

/** 서비스 정보 화면을 정책 링크가 동작하는 라우터 안에서 렌더링한다. */
function renderServiceInfoPage() {
  render(
    <MemoryRouter>
      <ContactPage />
    </MemoryRouter>,
  )
}
