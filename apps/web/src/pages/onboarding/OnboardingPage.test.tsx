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
    fireEvent.change(screen.getByLabelText(/^한 줄 소개/), { target: { value: '함께 읽어요.' } })
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
      await screen.findByText('프로필 정보를 불러오지 못했어요. 다시 시도해 주세요.'),
    ).toBeInTheDocument()
  })

  it('marks invalid onboarding fields for assistive technology after submission', async () => {
    getProfile.mockResolvedValue({ bio: '', displayName: '', mbti: null })

    renderOnboardingPage()

    const nameInput = await screen.findByLabelText('이름')
    fireEvent.click(screen.getByRole('button', { name: '시작하기' }))

    expect(await screen.findByText('이름을 입력해 주세요.')).toBeInTheDocument()
    expect(nameInput).toHaveAttribute('data-invalid', '')
  })

  it('opens the MBTI picker as a SEED sheet and restores focus to its trigger', async () => {
    getProfile.mockResolvedValue({ bio: '', displayName: '민규', mbti: 'INTP' })

    renderOnboardingPage()

    const mbtiTrigger = await screen.findByRole('button', { name: 'MBTI: INTP' })
    fireEvent.click(mbtiTrigger)

    expect(await screen.findByRole('dialog', { name: 'MBTI 선택' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'ENFP' }))
    expect(mbtiTrigger).toHaveTextContent('ENFP')
  })

  it('retries the initial profile preparation without asking the member to refresh', async () => {
    const deferredProfile = createDeferredProfile()
    getProfile
      .mockRejectedValueOnce(new Error('profile unavailable'))
      .mockReturnValueOnce(deferredProfile.promise)

    renderOnboardingPage()

    await screen.findByText('프로필 정보를 불러오지 못했어요. 다시 시도해 주세요.')
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(
      await screen.findByRole('status', { name: '프로필을 준비하고 있어요.' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument()

    deferredProfile.resolve({ bio: '느리게 읽어요.', displayName: '민규', mbti: 'INTP' })

    expect(await screen.findByDisplayValue('민규')).toBeInTheDocument()
    expect(getProfile).toHaveBeenCalledTimes(2)
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

/** 테스트에서 재시도 완료 시점을 제어할 수 있는 프로필 Promise를 만든다. */
function createDeferredProfile() {
  type Profile = { bio: string; displayName: string; mbti: string }
  let resolve: (profile: Profile) => void = () => undefined
  const promise = new Promise<Profile>((complete) => {
    resolve = complete
  })

  return { promise, resolve }
}
