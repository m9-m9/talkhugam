import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { NaverAccountInfoPage } from './NaverAccountInfoPage'

vi.mock('../../features/auth', () => ({
  useAuthenticatedUser: () => ({
    appMetadata: { provider: 'naver' },
    email: 'reader@naver.com',
    id: '00000000-0000-4000-8000-000000000001',
    userMetadata: { gender: 'M', name: '민규' },
  }),
}))

describe('NaverAccountInfoPage', () => {
  it('shows only the Naver fields returned by the signed-in identity', () => {
    renderNaverAccountInfoPage()

    expect(screen.getByRole('heading', { name: 'Naver 제공 정보' })).toBeInTheDocument()
    expect(screen.getByText('민규')).toBeInTheDocument()
    expect(screen.getByText('reader@naver.com')).toBeInTheDocument()
    expect(screen.getByText('남성')).toBeInTheDocument()
    expect(screen.getAllByText('제공되지 않음')).toHaveLength(2)
  })
})

/** Naver 제공 정보 화면의 라우팅 동작을 구성해 렌더링한다. */
function renderNaverAccountInfoPage() {
  return render(
    <MemoryRouter initialEntries={['/profile/settings/naver-info']}>
      <Routes>
        <Route element={<NaverAccountInfoPage />} path="/profile/settings/naver-info" />
      </Routes>
    </MemoryRouter>,
  )
}
