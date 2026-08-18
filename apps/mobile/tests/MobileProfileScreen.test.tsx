import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import type { PropsWithChildren } from 'react'

jest.mock('../src/entities/profile')
jest.mock('../src/shared/api/mobileSupabaseClient')
jest.mock('../src/shared/api/MobileAppProviders', () => ({ useMobileSessionProfileId: jest.fn() }))

import {
  getMobileNotificationPreferences,
  getMobileProfile,
  updateMobileNotificationPreferences,
} from '../src/entities/profile'
import { MobileProfileScreen } from '../src/features/profile/MobileProfileScreen'
import { useMobileSessionProfileId } from '../src/shared/api/MobileAppProviders'
import { createMobileSupabaseClient } from '../src/shared/api/mobileSupabaseClient'

const mockGetMobileNotificationPreferences = jest.mocked(getMobileNotificationPreferences)
const mockGetMobileProfile = jest.mocked(getMobileProfile)
const mockUpdateMobileNotificationPreferences = jest.mocked(updateMobileNotificationPreferences)
const mockUseMobileSessionProfileId = jest.mocked(useMobileSessionProfileId)
const mockCreateMobileSupabaseClient = jest.mocked(createMobileSupabaseClient)
const profileId = '00000000-0000-4000-8000-000000000001'
const signOut = jest.fn(async () => ({ error: null }))
const mobileClient = { auth: { signOut } } as never

/** 화면마다 격리된 서버 상태를 제공할 Query Client를 만든다. */
function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      mutations: { gcTime: Infinity, retry: false },
      queries: { gcTime: Infinity, retry: false },
    },
  })
}

/** 테스트 화면에만 독립된 Query Client를 연결하는 래퍼를 반환한다. */
function createQueryWrapper(
  queryClient = createQueryClient(),
): ({ children }: PropsWithChildren) => React.JSX.Element {
  /** 하위 컴포넌트에 테스트 전용 Query Client를 제공한다. */
  return function QueryWrapper({ children }: PropsWithChildren): React.JSX.Element {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('MobileProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCreateMobileSupabaseClient.mockReturnValue(mobileClient)
    mockUseMobileSessionProfileId.mockReturnValue(profileId)
    mockGetMobileProfile.mockResolvedValue({
      avatarPath: null,
      bio: '느리게 읽어요.',
      displayName: '민규',
      onboardingCompletedAt: '2026-08-18T00:00:00.000Z',
      updatedAt: '2026-08-18T00:00:00.000Z',
    })
    mockGetMobileNotificationPreferences.mockResolvedValue({
      mentionsEnabled: true,
      repliesEnabled: true,
      roomEventsEnabled: false,
    })
    mockUpdateMobileNotificationPreferences.mockResolvedValue({
      mentionsEnabled: false,
      repliesEnabled: true,
      roomEventsEnabled: false,
    })
    signOut.mockResolvedValue({ error: null })
  })

  it('shows only the signed-in member profile and offers its edit route', async () => {
    const onEditProfile = jest.fn()

    render(
      <MobileProfileScreen onBack={jest.fn()} onEditProfile={onEditProfile} onSignedOut={jest.fn()} />,
      { wrapper: createQueryWrapper() },
    )

    expect(await screen.findByRole('header', { name: '내 정보' })).toBeVisible()
    expect(screen.getByText('민규')).toBeVisible()
    expect(screen.getByText('느리게 읽어요.')).toBeVisible()
    fireEvent.press(screen.getByRole('button', { name: '내 정보 수정' }))
    expect(onEditProfile).toHaveBeenCalledTimes(1)
    expect(mockGetMobileProfile).toHaveBeenCalledWith(mobileClient)
  })

  it('locks the three notification switches while one scoped save is pending', async () => {
    let resolveSave: ((preferences: {
      mentionsEnabled: boolean
      repliesEnabled: boolean
      roomEventsEnabled: boolean
    }) => void) | undefined
    mockUpdateMobileNotificationPreferences.mockReturnValue(
      new Promise((resolve) => {
        resolveSave = resolve
      }),
    )
    render(
      <MobileProfileScreen onBack={jest.fn()} onEditProfile={jest.fn()} onSignedOut={jest.fn()} />,
      { wrapper: createQueryWrapper() },
    )

    const mentionSwitch = await screen.findByRole('switch', { name: '멘션 알림' })
    fireEvent(mentionSwitch, 'valueChange', false)
    await waitFor(() => {
      expect(mockUpdateMobileNotificationPreferences).toHaveBeenCalledWith(mobileClient, {
        mentionsEnabled: false,
        repliesEnabled: true,
        roomEventsEnabled: false,
      })
    })
    fireEvent(mentionSwitch, 'valueChange', false)
    expect(mockUpdateMobileNotificationPreferences).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(screen.getByRole('switch', { name: '답글 알림' })).toBeDisabled()
    })

    resolveSave?.({ mentionsEnabled: false, repliesEnabled: true, roomEventsEnabled: false })
    await waitFor(() => expect(screen.getByRole('switch', { name: '답글 알림' })).toBeEnabled())
  })

  it('keeps a preference save error separate from its retryable load error', async () => {
    mockUpdateMobileNotificationPreferences.mockRejectedValueOnce(new Error('network'))
    render(
      <MobileProfileScreen onBack={jest.fn()} onEditProfile={jest.fn()} onSignedOut={jest.fn()} />,
      { wrapper: createQueryWrapper() },
    )

    fireEvent(await screen.findByRole('switch', { name: '멘션 알림' }), 'valueChange', false)

    expect(
      await screen.findByRole('alert', {
        name: '알림 설정을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.',
      }),
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: '알림 설정 다시 불러오기' })).toBeNull()
  })

  it('signs out before requesting the safe login route', async () => {
    const onSignedOut = jest.fn()
    render(
      <MobileProfileScreen onBack={jest.fn()} onEditProfile={jest.fn()} onSignedOut={onSignedOut} />,
      { wrapper: createQueryWrapper() },
    )

    fireEvent.press(await screen.findByRole('button', { name: '로그아웃' }))

    await waitFor(() => {
      expect(signOut).toHaveBeenCalledTimes(1)
      expect(onSignedOut).toHaveBeenCalledTimes(1)
    })
  })
})
