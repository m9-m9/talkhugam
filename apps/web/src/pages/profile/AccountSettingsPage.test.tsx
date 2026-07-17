import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AccountSettingsPage } from './AccountSettingsPage'

const { getNotificationPreferences, requestAccountDeletion, updateNotificationPreferences } =
  vi.hoisted(() => ({
    getNotificationPreferences: vi.fn().mockResolvedValue({
      mentionsEnabled: true,
      repliesEnabled: true,
      roomEventsEnabled: true,
    }),
    requestAccountDeletion: vi.fn().mockResolvedValue(undefined),
    updateNotificationPreferences: vi.fn().mockResolvedValue({
      mentionsEnabled: false,
      repliesEnabled: true,
      roomEventsEnabled: true,
    }),
  }))
const signOut = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }))

vi.mock('../../entities/profile', () => ({
  AccountDeletionError: class AccountDeletionError extends Error {},
  getNotificationPreferences,
  getProviderLabels: () => ['Google'],
  requestAccountDeletion,
  updateNotificationPreferences,
}))

vi.mock('../../features/auth', () => ({
  useAuthenticatedUser: () => ({
    appMetadata: { provider: 'google' },
    email: 'hello@example.com',
    id: '11111111-1111-4111-8111-111111111111',
  }),
}))

vi.mock('../../shared/api/supabaseClient', () => ({
  createSupabaseClient: () => ({ auth: { signOut }, functions: { invoke: vi.fn() } }),
}))

describe('AccountSettingsPage', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('stores a changed notification preference for the signed-in user', async () => {
    renderAccountSettingsPage()

    const mentionToggle = await screen.findByRole('checkbox', { name: '멘션 알림' })
    fireEvent.click(mentionToggle)

    await waitFor(() => {
      expect(updateNotificationPreferences).toHaveBeenCalledWith(
        expect.anything(),
        '11111111-1111-4111-8111-111111111111',
        {
          mentionsEnabled: false,
          repliesEnabled: true,
          roomEventsEnabled: true,
        },
      )
    })
  })

  it('requires a deletion mode and confirmation before deleting the account', async () => {
    renderAccountSettingsPage()

    fireEvent.click(screen.getByRole('button', { name: '계정 삭제' }))
    expect(screen.getByRole('dialog', { name: '계정 삭제' })).toBeInTheDocument()

    const confirmButton = screen.getByRole('button', { name: '계정 삭제하기' })
    expect(confirmButton).toBeDisabled()

    fireEvent.click(screen.getByRole('radio', { name: '대화 기록은 남기고 탈퇴' }))
    fireEvent.click(
      screen.getByRole('checkbox', { name: '선택한 방식으로 계정을 삭제하는 데 동의합니다.' }),
    )
    expect(confirmButton).toBeEnabled()

    fireEvent.click(confirmButton)
    await waitFor(() => {
      expect(requestAccountDeletion).toHaveBeenCalledWith(expect.anything(), 'anonymize')
      expect(signOut).toHaveBeenCalledTimes(1)
    })
  })
})

/** 계정 설정 페이지에 필요한 라우터와 서버 상태 Provider를 구성해 렌더링한다. */
function renderAccountSettingsPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/profile/settings']}>
        <Routes>
          <Route path="/profile/settings" element={<AccountSettingsPage />} />
          <Route path="/" element={<p>로그인</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
