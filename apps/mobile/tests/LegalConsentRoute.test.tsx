import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'

jest.mock('../src/shared/api/mobileSupabaseClient')
jest.mock('../src/features/auth/resolveMobileAuthDestination')
jest.mock('../src/entities/legal/saveMobileRequiredLegalConsents')
jest.mock('expo-router', () => ({ useLocalSearchParams: jest.fn(), useRouter: jest.fn() }))

import { resolveMobileAuthDestination } from '../src/features/auth/resolveMobileAuthDestination'
import { saveMobileRequiredLegalConsents } from '../src/entities/legal/saveMobileRequiredLegalConsents'
import { createMobileSupabaseClient } from '../src/shared/api/mobileSupabaseClient'
import { useLocalSearchParams, useRouter } from 'expo-router'

import LegalConsentRoute from '../app/legal-consent'

const mockCreateMobileSupabaseClient = jest.mocked(createMobileSupabaseClient)
const mockResolveMobileAuthDestination = jest.mocked(resolveMobileAuthDestination)
const mockSaveMobileRequiredLegalConsents = jest.mocked(saveMobileRequiredLegalConsents)
const mockUseLocalSearchParams = jest.mocked(useLocalSearchParams)
const mockUseRouter = jest.mocked(useRouter)
const invitePath = `/rooms/join?invite=${'a'.repeat(64)}`

describe('LegalConsentRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCreateMobileSupabaseClient.mockReturnValue({} as never)
    mockUseRouter.mockReturnValue({ replace: jest.fn() } as never)
    mockUseLocalSearchParams.mockReturnValue({} as never)
  })

  it('redirects an unauthenticated direct visit before rendering the consent form', async () => {
    const replace = jest.fn()
    mockUseRouter.mockReturnValue({ replace } as never)
    mockResolveMobileAuthDestination.mockRejectedValue(new Error('no session'))

    render(<LegalConsentRoute />)

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'))
    expect(screen.queryByRole('checkbox', { name: '이용약관에 동의합니다.' })).toBeNull()
  })

  it('redirects an already consented member to the current allowed route', async () => {
    const replace = jest.fn()
    mockUseRouter.mockReturnValue({ replace } as never)
    mockResolveMobileAuthDestination.mockResolvedValue('/rooms')

    render(<LegalConsentRoute />)

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/rooms'))
    expect(screen.queryByRole('checkbox', { name: '이용약관에 동의합니다.' })).toBeNull()
  })

  it('keeps the verified invite route while legal consent advances a member to onboarding', async () => {
    const replace = jest.fn()
    mockUseRouter.mockReturnValue({ replace } as never)
    mockUseLocalSearchParams.mockReturnValue({ returnTo: invitePath } as never)
    mockResolveMobileAuthDestination
      .mockResolvedValueOnce('/legal-consent')
      .mockResolvedValueOnce('/onboarding')
    mockSaveMobileRequiredLegalConsents.mockResolvedValue(undefined)

    render(<LegalConsentRoute />)

    fireEvent.press(await screen.findByRole('checkbox', { name: '이용약관에 동의합니다.' }))
    fireEvent.press(screen.getByRole('checkbox', { name: '개인정보처리방침에 동의합니다.' }))
    fireEvent.press(screen.getByRole('button', { name: '동의하고 계속하기' }))

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith(`/onboarding?returnTo=${encodeURIComponent(invitePath)}`)
    })
  })
})
