import { fireEvent, render, screen } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AnalyticsLayout } from './AnalyticsLayout'

const { loadGa4, trackPageView } = vi.hoisted(() => ({
  loadGa4: vi.fn(),
  trackPageView: vi.fn(),
}))

vi.mock('../../shared/analytics', () => ({ loadGa4, trackPageView }))
vi.mock('../env', () => ({
  getClientEnv: () => ({
    VITE_GA_MEASUREMENT_ID: 'G-TEST123',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
    VITE_SUPABASE_URL: 'https://talkhugam.supabase.co',
  }),
}))

describe('AnalyticsLayout', () => {
  afterEach(() => vi.clearAllMocks())

  it('sends one page view for each SPA location change', () => {
    render(
      <MemoryRouter initialEntries={['/rooms']}>
        <Routes>
          <Route element={<AnalyticsLayout />}>
            <Route path="/rooms" element={<Link to="/profile">내 정보로</Link>} />
            <Route path="/profile" element={<p>내 정보</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(trackPageView).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('link', { name: '내 정보로' }))
    expect(trackPageView).toHaveBeenCalledTimes(2)
  })
})
