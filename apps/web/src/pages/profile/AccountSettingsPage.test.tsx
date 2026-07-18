import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
  beforeEach(() => {
    getNotificationPreferences.mockResolvedValue({
      mentionsEnabled: true,
      repliesEnabled: true,
      roomEventsEnabled: true,
    })
    requestAccountDeletion.mockResolvedValue(undefined)
    updateNotificationPreferences.mockResolvedValue({
      mentionsEnabled: false,
      repliesEnabled: true,
      roomEventsEnabled: true,
    })
    signOut.mockResolvedValue({ error: null })
  })

  afterEach(() => {
    cleanup()
    vi.resetAllMocks()
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

  it('shows a separate retry state when notification preferences cannot be loaded', async () => {
    getNotificationPreferences.mockRejectedValueOnce(new Error('network'))
    renderAccountSettingsPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '알림 설정을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
    )
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument()
    expect(
      screen.queryByText('알림 설정을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.'),
    ).not.toBeInTheDocument()
  })

  it('shows the book loader and disables retry while notification preference lookup retries', async () => {
    const deferredPreferences = createDeferredValue<{
      mentionsEnabled: boolean
      repliesEnabled: boolean
      roomEventsEnabled: boolean
    }>()
    getNotificationPreferences
      .mockRejectedValueOnce(new Error('network'))
      .mockReturnValueOnce(deferredPreferences.promise)
    renderAccountSettingsPage()

    fireEvent.click(await screen.findByRole('button', { name: '다시 시도' }))

    expect(
      await screen.findByRole('status', { name: '알림 설정을 다시 불러오고 있어요.' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeDisabled()

    deferredPreferences.resolve({
      mentionsEnabled: true,
      repliesEnabled: true,
      roomEventsEnabled: true,
    })

    expect(await screen.findByRole('checkbox', { name: '멘션 알림' })).toBeInTheDocument()
  })

  it('shows a save error without offering the query retry action', async () => {
    updateNotificationPreferences.mockRejectedValueOnce(new Error('network'))
    renderAccountSettingsPage()

    fireEvent.click(await screen.findByRole('checkbox', { name: '멘션 알림' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '알림 설정을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.',
    )
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument()
  })

  it('links service policies and contact from account settings', async () => {
    renderAccountSettingsPage()

    expect(await screen.findByRole('link', { name: '서비스 정보' })).toHaveAttribute(
      'href',
      '/contact',
    )
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

  it('focuses the first deletion option, traps focus, and restores the trigger after dismissal', async () => {
    renderAccountSettingsPage()

    const trigger = screen.getByRole('button', { name: '계정 삭제' })
    fireEvent.click(trigger)

    const firstMode = screen.getByRole('radio', { name: '대화 기록은 남기고 탈퇴' })
    await waitFor(() => expect(firstMode).toHaveFocus())

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(screen.getByRole('button', { name: '취소' })).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Tab' })
    expect(firstMode).toHaveFocus()

    fireEvent.keyDown(window, { key: 'Escape' })

    await waitFor(() => expect(trigger).toHaveFocus())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('restores the deletion trigger focus after clicking the modal backdrop', async () => {
    renderAccountSettingsPage()

    const trigger = screen.getByRole('button', { name: '계정 삭제' })
    fireEvent.click(trigger)
    const dialog = screen.getByRole('dialog')
    const backdrop = dialog.parentElement
    if (!backdrop) throw new Error('계정 삭제 확인창의 배경을 찾지 못했습니다.')

    fireEvent.mouseDown(backdrop)

    await waitFor(() => expect(trigger).toHaveFocus())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('returns to sign-in even when local session cleanup fails after server deletion', async () => {
    signOut.mockRejectedValueOnce(new Error('local session unavailable'))
    renderAccountSettingsPage()

    fireEvent.click(screen.getByRole('button', { name: '계정 삭제' }))
    fireEvent.click(screen.getByRole('radio', { name: '대화 기록은 남기고 탈퇴' }))
    fireEvent.click(
      screen.getByRole('checkbox', { name: '선택한 방식으로 계정을 삭제하는 데 동의합니다.' }),
    )
    fireEvent.click(screen.getByRole('button', { name: '계정 삭제하기' }))

    expect(await screen.findByText('로그인')).toBeInTheDocument()
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

/** 테스트에서 수동으로 완료 시점을 제어할 비동기 값을 만든다. */
function createDeferredValue<Value>() {
  let resolve: (resolvedValue: Value) => void = () => undefined
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise
  })

  return { promise, resolve }
}
