import { render, waitFor } from '@testing-library/react-native'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'

jest.mock('../src/shared/api/mobileSupabaseClient')
jest.mock('../src/features/auth/resolveMobileAuthDestination')
jest.mock('expo-router', () => ({ useLocalSearchParams: jest.fn(), useRouter: jest.fn() }))

import { resolveMobileAuthDestination } from '../src/features/auth/resolveMobileAuthDestination'
import { useLocalSearchParams, useRouter } from 'expo-router'

import JoinRoomRoute from '../app/rooms/join'

const mockResolveMobileAuthDestination = jest.mocked(resolveMobileAuthDestination)
const mockUseLocalSearchParams = jest.mocked(useLocalSearchParams)
const mockUseRouter = jest.mocked(useRouter)
const inviteToken = 'a'.repeat(64)

describe('JoinRoomRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseRouter.mockReturnValue({ replace: jest.fn() } as never)
    mockUseLocalSearchParams.mockReturnValue({ invite: inviteToken } as never)
  })

  it('keeps an unauthenticated invite link as the login return path', async () => {
    const replace = jest.fn()
    mockUseRouter.mockReturnValue({ replace } as never)
    mockResolveMobileAuthDestination.mockRejectedValue(new Error('no session'))

    render(<JoinRoomRoute />)

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith(
        `/?returnTo=${encodeURIComponent(`/rooms/join?invite=${inviteToken}`)}`,
      )
    })
  })
})
