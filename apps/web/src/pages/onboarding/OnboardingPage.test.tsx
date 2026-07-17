import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { OnboardingPage } from './OnboardingPage'

const { completeOnboarding, getProfile } = vi.hoisted(() => ({
  completeOnboarding: vi.fn(),
  getProfile: vi.fn(),
}))

vi.mock('../../entities/profile', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../entities/profile')>()),
  completeOnboarding,
  getProfile,
}))

vi.mock('../../features/auth', () => ({
  useAuthenticatedUser: () => ({ id: '00000000-0000-0000-0000-000000000001' }),
}))

vi.mock('../../shared/api/supabaseClient', () => ({ createSupabaseClient: vi.fn() }))

describe('OnboardingPage', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('saves the prepared profile and sends the member to their reading rooms', async () => {
    getProfile.mockResolvedValue({ bio: '느리게 읽어요.', displayName: '민규', mbti: 'INTP' })
    completeOnboarding.mockResolvedValue(undefined)

    renderOnboardingPage()

    expect(await screen.findByDisplayValue('민규')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('한 줄 소개'), { target: { value: '함께 읽어요.' } })
    fireEvent.click(screen.getByRole('button', { name: '시작하기' }))

    await waitFor(() => {
      expect(completeOnboarding).toHaveBeenCalledWith(
        undefined,
        '00000000-0000-0000-0000-000000000001',
        { bio: '함께 읽어요.', displayName: '민규', mbti: 'INTP' },
      )
    })
    expect(await screen.findByText('내 독서방 화면')).toBeInTheDocument()
  })

  it('explains when the initial profile cannot be prepared', async () => {
    getProfile.mockRejectedValue(new Error('profile unavailable'))

    renderOnboardingPage()

    expect(
      await screen.findByText('프로필 정보를 불러오지 못했어요. 새로고침 후 다시 시도해 주세요.'),
    ).toBeInTheDocument()
  })
})

/** 온보딩 화면의 라우터와 서버 상태 Provider를 구성해 렌더링한다. */
function renderOnboardingPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/onboarding']}>
        <Routes>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/rooms" element={<p>내 독서방 화면</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
