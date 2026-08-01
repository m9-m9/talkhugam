import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { AuthenticatedRoute, useAuthenticatedUser } from '.'

const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }))

vi.mock('../../shared/api/supabaseClient', () => ({
  createSupabaseClient: () => ({ auth: { getUser } }),
}))

describe('AuthenticatedRoute', () => {
  it('provides the authenticated user to protected pages', async () => {
    getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    })

    renderProtectedRoute()

    expect(await screen.findByText('user-1')).toBeInTheDocument()
  })

  it('redirects an unauthenticated visitor to login', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null })

    renderProtectedRoute()

    expect(await screen.findByText('로그인 화면')).toBeInTheDocument()
  })

  it('uses the compact book loader while checking the protected session', () => {
    getUser.mockReturnValue(new Promise<never>(() => undefined))

    const { container } = renderProtectedRoute()

    expect(
      screen.getByRole('status', { name: '로그인 정보를 확인하고 있어요.' }),
    ).toBeInTheDocument()
    expect(container.querySelector('.talkhugam-book-loader--sm')).toBeInTheDocument()
  })
})

function renderProtectedRoute() {
  return render(
    <MemoryRouter initialEntries={['/rooms']}>
      <Routes>
        <Route element={<AuthenticatedRoute />}>
          <Route path="/rooms" element={<ProtectedPage />} />
        </Route>
        <Route path="/" element={<p>로그인 화면</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

function ProtectedPage() {
  const user = useAuthenticatedUser()
  return <p>{user.id}</p>
}
