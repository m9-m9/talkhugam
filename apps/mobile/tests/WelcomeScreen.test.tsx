import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'

jest.mock('../src/shared/api/mobileSupabaseClient')
jest.mock('../src/features/auth/openMobileOAuthSession')
jest.mock('../src/features/auth/resolveMobileAuthDestination')
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }))
jest.mock('expo-router', () => ({ useLocalSearchParams: jest.fn(), useRouter: jest.fn() }))

import { openMobileOAuthSession } from '../src/features/auth/openMobileOAuthSession'
import { resolveMobileAuthDestination } from '../src/features/auth/resolveMobileAuthDestination'
import { createMobileSupabaseClient } from '../src/shared/api/mobileSupabaseClient'
import { useLocalSearchParams, useRouter } from 'expo-router'

import WelcomeScreen from '../app/index'

const mockCreateMobileSupabaseClient = jest.mocked(createMobileSupabaseClient)
const mockOpenMobileOAuthSession = jest.mocked(openMobileOAuthSession)
const mockResolveMobileAuthDestination = jest.mocked(resolveMobileAuthDestination)
const mockUseLocalSearchParams = jest.mocked(useLocalSearchParams)
const mockUseRouter = jest.mocked(useRouter)
const invitePath = `/rooms/join?invite=${'a'.repeat(64)}`

describe('WelcomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCreateMobileSupabaseClient.mockReturnValue({
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
      },
    } as never)
    mockUseRouter.mockReturnValue({ replace: jest.fn() } as never)
    mockUseLocalSearchParams.mockReturnValue({} as never)
  })

  /** 익명 세션 확인을 마친 뒤 실제 로그인 조작을 할 수 있는 화면을 렌더링한다. */
  async function renderReadyWelcomeScreen(): Promise<void> {
    render(<WelcomeScreen />)
    await screen.findByRole('button', { name: '카카오로 계속하기' })
  }

  it('provides Google and Kakao sign-in actions', async () => {
    await renderReadyWelcomeScreen()

    expect(screen.getByRole('button', { name: '카카오로 계속하기' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Google로 계속하기' })).toBeVisible()
  })

  it('disables both providers while a sign-in request is pending', async () => {
    mockOpenMobileOAuthSession.mockReturnValue(new Promise(() => undefined))
    await renderReadyWelcomeScreen()

    fireEvent.press(screen.getByText('Google로 계속하기'))

    expect(mockCreateMobileSupabaseClient).toHaveBeenCalledTimes(2)
    expect(mockOpenMobileOAuthSession).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '카카오로 계속하기' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Google로 계속하기' })).toBeDisabled()
      expect(screen.getByLabelText('로그인을 연결하고 있어요.')).toBeVisible()
    })
  })

  it('starts only one OAuth browser session when a provider is pressed twice in one render', async () => {
    mockOpenMobileOAuthSession.mockReturnValue(new Promise(() => undefined))
    await renderReadyWelcomeScreen()

    act(() => {
      fireEvent.press(screen.getByText('Google로 계속하기'))
      fireEvent.press(screen.getByText('Google로 계속하기'))
    })

    expect(mockCreateMobileSupabaseClient).toHaveBeenCalledTimes(2)
    expect(mockOpenMobileOAuthSession).toHaveBeenCalledTimes(1)
  })

  it('shows a retryable alert when sign-in cannot start', async () => {
    mockOpenMobileOAuthSession.mockRejectedValue(new Error('oauth'))
    await renderReadyWelcomeScreen()

    fireEvent.press(screen.getByText('카카오로 계속하기'))

    expect(
      await screen.findByRole('alert', {
        name: '로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.',
      }),
    ).toBeVisible()
  })

  it('returns to the idle state without an error when sign-in is cancelled', async () => {
    let completeLogin: ((result: 'cancelled') => void) | undefined
    mockOpenMobileOAuthSession.mockReturnValue(
      new Promise<'cancelled'>((resolve) => {
        completeLogin = resolve
      }),
    )
    await renderReadyWelcomeScreen()

    fireEvent.press(screen.getByText('Google로 계속하기'))

    expect(mockOpenMobileOAuthSession).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Google로 계속하기' })).toBeDisabled()
    })
    completeLogin?.('cancelled')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Google로 계속하기' })).toBeEnabled()
      expect(screen.queryByRole('alert')).toBeNull()
    })
  })

  it('routes a successful OAuth session only after the access destination is resolved', async () => {
    const replace = jest.fn()
    mockUseRouter.mockReturnValue({ replace } as never)
    mockOpenMobileOAuthSession.mockResolvedValue('authenticated')
    mockResolveMobileAuthDestination.mockResolvedValue('/legal-consent')
    await renderReadyWelcomeScreen()

    fireEvent.press(screen.getByText('Google로 계속하기'))

    await waitFor(() => {
      expect(mockResolveMobileAuthDestination).toHaveBeenCalledWith(
        mockCreateMobileSupabaseClient.mock.results[0]?.value,
      )
      expect(replace).toHaveBeenCalledWith('/legal-consent')
    })
  })

  it('preserves a verified invite route when successful OAuth must continue through legal consent', async () => {
    const replace = jest.fn()
    mockUseRouter.mockReturnValue({ replace } as never)
    mockUseLocalSearchParams.mockReturnValue({ returnTo: invitePath } as never)
    mockOpenMobileOAuthSession.mockResolvedValue('authenticated')
    mockResolveMobileAuthDestination.mockResolvedValue('/legal-consent')
    await renderReadyWelcomeScreen()

    fireEvent.press(screen.getByText('Google로 계속하기'))

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith(
        `/legal-consent?returnTo=${encodeURIComponent(invitePath)}`,
      )
    })
  })

  it('routes a persisted authenticated session before exposing social sign-in actions', async () => {
    const replace = jest.fn()
    mockUseRouter.mockReturnValue({ replace } as never)
    mockCreateMobileSupabaseClient.mockReturnValue({
      auth: {
        getSession: async () => ({ data: { session: { access_token: 'token' } }, error: null }),
      },
    } as never)
    mockResolveMobileAuthDestination.mockResolvedValue('/rooms')

    render(<WelcomeScreen />)

    expect(screen.getByLabelText('계정 정보를 확인하고 있어요.')).toBeVisible()
    await waitFor(() => {
      expect(mockResolveMobileAuthDestination).toHaveBeenCalledTimes(1)
      expect(replace).toHaveBeenCalledWith('/rooms')
    })
  })
})
