import { render, screen, waitFor } from '@testing-library/react-native'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'

jest.mock('../src/shared/api/mobileSupabaseClient')
jest.mock('../src/features/auth/resolveMobileAuthDestination')
jest.mock('../src/entities/legal/saveMobileRequiredLegalConsents')
jest.mock('expo-router', () => ({ useRouter: jest.fn() }))

import { resolveMobileAuthDestination } from '../src/features/auth/resolveMobileAuthDestination'
import { createMobileSupabaseClient } from '../src/shared/api/mobileSupabaseClient'
import { useRouter } from 'expo-router'

import LegalConsentRoute from '../app/legal-consent'

const mockCreateMobileSupabaseClient = jest.mocked(createMobileSupabaseClient)
const mockResolveMobileAuthDestination = jest.mocked(resolveMobileAuthDestination)
const mockUseRouter = jest.mocked(useRouter)

describe('LegalConsentRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCreateMobileSupabaseClient.mockReturnValue({} as never)
    mockUseRouter.mockReturnValue({ replace: jest.fn() } as never)
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
})
