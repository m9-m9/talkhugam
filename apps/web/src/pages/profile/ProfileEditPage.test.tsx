import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ProfileEditPage } from './ProfileEditPage'

const { getProfile, updateProfile } = vi.hoisted(() => ({
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
}))

vi.mock('../../entities/profile', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../entities/profile')>()),
  getProfile,
  updateProfile,
}))

vi.mock('../../features/auth', () => ({
  useAuthenticatedUser: () => ({ id: '00000000-0000-0000-0000-000000000001' }),
}))

vi.mock('../../shared/api/supabaseClient', () => ({ createSupabaseClient: vi.fn() }))

describe('ProfileEditPage', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('updates the loaded profile and returns to my profile', async () => {
    getProfile.mockResolvedValue({ bio: '기존 소개', displayName: '민규', mbti: 'INTP' })
    updateProfile.mockResolvedValue(undefined)

    renderProfileEditPage()

    expect(await screen.findByDisplayValue('민규')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('이름'), { target: { value: '정민규' } })
    fireEvent.click(screen.getByRole('button', { name: '저장하기' }))

    await waitFor(() => {
      expect(updateProfile).toHaveBeenCalledWith(
        undefined,
        '00000000-0000-0000-0000-000000000001',
        { bio: '기존 소개', displayName: '정민규', mbti: 'INTP' },
      )
    })
    expect(await screen.findByText('내 프로필 화면')).toBeInTheDocument()
  })

  it('keeps the form visible and shows a retry message when saving fails', async () => {
    getProfile.mockResolvedValue({ bio: null, displayName: '민규', mbti: null })
    updateProfile.mockRejectedValue(new Error('update unavailable'))

    renderProfileEditPage()

    await screen.findByDisplayValue('민규')
    fireEvent.click(screen.getByRole('button', { name: '저장하기' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '저장하지 못했어요. 잠시 후 다시 시도해 주세요.',
    )
    expect(screen.getByRole('button', { name: '저장하기' })).toBeEnabled()
  })

  it('retries the initial profile query after it fails', async () => {
    getProfile
      .mockRejectedValueOnce(new Error('profile unavailable'))
      .mockResolvedValueOnce({ bio: '기존 소개', displayName: '민규', mbti: 'INTP' })

    renderProfileEditPage()

    expect(await screen.findByText('프로필 정보를 불러오지 못했어요.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(await screen.findByDisplayValue('민규')).toBeInTheDocument()
    expect(getProfile).toHaveBeenCalledTimes(2)
  })
})

/** 프로필 편집 화면의 라우터와 서버 상태 Provider를 구성해 렌더링한다. */
function renderProfileEditPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/profile/edit']}>
        <Routes>
          <Route path="/profile/edit" element={<ProfileEditPage />} />
          <Route path="/profile" element={<p>내 프로필 화면</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
