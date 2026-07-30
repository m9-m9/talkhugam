import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ProfileEditPage } from './ProfileEditPage'

const { getProfile, updateProfile, uploadProfileAvatar } = vi.hoisted(() => ({
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
  uploadProfileAvatar: vi.fn(),
}))

vi.mock('../../entities/profile', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../entities/profile')>()),
  getProfile,
  updateProfile,
  uploadProfileAvatar,
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
    getProfile.mockResolvedValue({ bio: '기존 소개', displayName: '민규' })
    updateProfile.mockResolvedValue(undefined)

    renderProfileEditPage()

    expect(await screen.findByDisplayValue('민규')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('이름'), { target: { value: '정민규' } })
    fireEvent.click(screen.getByRole('button', { name: '저장하기' }))

    await waitFor(() => {
      expect(updateProfile).toHaveBeenCalledWith(
        undefined,
        '00000000-0000-0000-0000-000000000001',
        { bio: '기존 소개', displayName: '정민규' },
      )
    })
    expect(await screen.findByText('내 프로필 화면')).toBeInTheDocument()
  })

  it('keeps saving disabled until the user changes a profile field and offers a back button', async () => {
    getProfile.mockResolvedValue({ bio: '기존 소개', displayName: '민규' })

    renderProfileEditPage()

    expect(await screen.findByDisplayValue('민규')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '이전 화면으로' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '저장하기' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('한 줄 소개'), { target: { value: '바뀐 소개' } })

    expect(screen.getByRole('button', { name: '저장하기' })).toBeEnabled()
  })

  it('uses SEED controls for profile changes without showing MBTI', async () => {
    getProfile.mockResolvedValue({ bio: '기존 소개', displayName: '민규' })

    renderProfileEditPage()

    expect(await screen.findByDisplayValue('민규')).toHaveClass('seed-text-input__value')
    expect(screen.getByLabelText('한 줄 소개')).toHaveClass('seed-text-input__value')
    expect(screen.getByRole('button', { name: '사진 변경' })).toHaveClass('seed-action-button')
    expect(screen.queryByText('MBTI')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '저장하기' })).toHaveClass('seed-action-button')
  })

  it('keeps the form visible and shows a retry message when saving fails', async () => {
    getProfile.mockResolvedValue({ bio: null, displayName: '민규' })
    updateProfile.mockRejectedValue(new Error('update unavailable'))

    renderProfileEditPage()

    await screen.findByDisplayValue('민규')
    fireEvent.change(screen.getByLabelText('한 줄 소개'), { target: { value: '새 소개' } })
    fireEvent.click(screen.getByRole('button', { name: '저장하기' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '저장하지 못했어요. 잠시 후 다시 시도해 주세요.',
    )
    expect(screen.getByRole('button', { name: '저장하기' })).toBeEnabled()
  })

  it('retries the initial profile query after it fails', async () => {
    getProfile
      .mockRejectedValueOnce(new Error('profile unavailable'))
      .mockResolvedValueOnce({ bio: '기존 소개', displayName: '민규' })

    renderProfileEditPage()

    expect(await screen.findByText('프로필 정보를 불러오지 못했어요.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(await screen.findByDisplayValue('민규')).toBeInTheDocument()
    expect(getProfile).toHaveBeenCalledTimes(2)
  })

  it('uploads an allowed profile photo immediately after the user chooses it', async () => {
    getProfile.mockResolvedValue({ bio: null, displayName: '민규' })
    uploadProfileAvatar.mockResolvedValue('00000000-0000-0000-0000-000000000001/avatar')

    renderProfileEditPage()

    await screen.findByDisplayValue('민규')
    const photo = new File(['photo'], 'profile.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('프로필 사진 선택'), { target: { files: [photo] } })

    await waitFor(() => {
      expect(uploadProfileAvatar).toHaveBeenCalledWith(
        undefined,
        '00000000-0000-0000-0000-000000000001',
        photo,
      )
    })
  })

  it('uses white information surfaces for editable profile values', async () => {
    getProfile.mockResolvedValue({ bio: null, displayName: '민규' })
    renderProfileEditPage()

    expect(
      (await screen.findByDisplayValue('민규')).closest('.talkhugam-information-field'),
    ).not.toBeNull()
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
