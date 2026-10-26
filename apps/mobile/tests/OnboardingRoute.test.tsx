import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'

jest.mock('../src/shared/api/mobileSupabaseClient')
jest.mock('../src/features/auth/resolveMobileAuthDestination')
jest.mock('../src/entities/profile/mobileProfile')
jest.mock('expo-router', () => ({ useLocalSearchParams: jest.fn(), useRouter: jest.fn() }))

import { resolveMobileAuthDestination } from '../src/features/auth/resolveMobileAuthDestination'
import { completeMobileOnboarding, getMobileProfile } from '../src/entities/profile/mobileProfile'
import { createMobileSupabaseClient } from '../src/shared/api/mobileSupabaseClient'
import { useLocalSearchParams, useRouter } from 'expo-router'

import OnboardingRoute from '../app/onboarding'

const mockCreateMobileSupabaseClient = jest.mocked(createMobileSupabaseClient)
const mockCompleteMobileOnboarding = jest.mocked(completeMobileOnboarding)
const mockGetMobileProfile = jest.mocked(getMobileProfile)
const mockResolveMobileAuthDestination = jest.mocked(resolveMobileAuthDestination)
const mockUseLocalSearchParams = jest.mocked(useLocalSearchParams)
const mockUseRouter = jest.mocked(useRouter)
const invitePath = `/rooms/join?invite=${'a'.repeat(64)}`

describe('OnboardingRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCreateMobileSupabaseClient.mockReturnValue({} as never)
    mockUseRouter.mockReturnValue({ replace: jest.fn() } as never)
    mockUseLocalSearchParams.mockReturnValue({} as never)
    mockGetMobileProfile.mockResolvedValue({
      avatarPath: null,
      bio: '',
      displayName: '민규',
      onboardingCompletedAt: null,
      updatedAt: '2026-08-18T00:00:00.000Z',
    })
  })

  it('redirects an unauthenticated direct visit before rendering profile fields', async () => {
    const replace = jest.fn()
    mockUseRouter.mockReturnValue({ replace } as never)
    mockResolveMobileAuthDestination.mockRejectedValue(new Error('no session'))

    render(<OnboardingRoute />)

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'))
    expect(screen.queryByLabelText('이름')).toBeNull()
  })

  it('redirects an already onboarded member to their rooms', async () => {
    const replace = jest.fn()
    mockUseRouter.mockReturnValue({ replace } as never)
    mockResolveMobileAuthDestination.mockResolvedValue('/rooms')

    render(<OnboardingRoute />)

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/rooms'))
    expect(screen.queryByLabelText('이름')).toBeNull()
  })

  it('returns to the verified invite route after the profile onboarding save succeeds', async () => {
    const replace = jest.fn()
    mockUseRouter.mockReturnValue({ replace } as never)
    mockUseLocalSearchParams.mockReturnValue({ returnTo: invitePath } as never)
    mockResolveMobileAuthDestination.mockResolvedValue('/onboarding')
    mockCompleteMobileOnboarding.mockResolvedValue(undefined)

    render(<OnboardingRoute />)

    fireEvent.press(await screen.findByRole('button', { name: '시작하기' }))

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith(invitePath)
    })
  })
})
