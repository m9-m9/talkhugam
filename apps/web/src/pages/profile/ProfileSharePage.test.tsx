import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { ProfileSharePage } from './ProfileSharePage'

const getProfile = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    bio: '느리게 읽고 오래 남겨요.',
    displayName: '민규',
    mbti: 'INTP',
  }),
)

vi.mock('../../entities/profile', () => ({ getProfile }))
vi.mock('../../features/auth', () => ({
  useAuthenticatedUser: () => ({ id: '00000000-0000-4000-8000-000000000001' }),
}))
vi.mock('../../shared/api/supabaseClient', () => ({ createSupabaseClient: vi.fn() }))

describe('ProfileSharePage', () => {
  it('previews a member share card and opens the native sharing path', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { share })
    renderProfileSharePage()

    expect(await screen.findByRole('heading', { name: '민규의 독서 카드' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '공유하기' }))

    expect(share).toHaveBeenCalledWith(expect.objectContaining({ title: '민규의 Talk후감 프로필' }))
  })

  it('uses SEED action buttons for sharing and returning from an unavailable card', async () => {
    renderProfileSharePage()

    const shareButton = await screen.findByRole('button', { name: '공유하기' })
    expect(shareButton).toHaveClass(/seed-action-button/)
    expect(shareButton).toHaveClass('!mt-8')
  })
})

/** 공유 카드 화면에 필요한 라우터와 서버 상태 Provider를 구성한다. */
function renderProfileSharePage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/profile/share']}>
        <Routes>
          <Route element={<ProfileSharePage />} path="/profile/share" />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
