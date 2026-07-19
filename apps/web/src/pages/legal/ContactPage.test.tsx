import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ContactPage } from './ContactPage'

vi.mock('../../app/env', () => ({
  getClientEnv: () => ({ VITE_SUPPORT_EMAIL: 'support@talkhugam.com' }),
}))

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
})

/** 서비스 정보 화면을 정책 링크가 동작하는 라우터 안에서 렌더링한다. */
function renderServiceInfoPage() {
  render(
    <MemoryRouter>
      <ContactPage />
    </MemoryRouter>,
  )
}
