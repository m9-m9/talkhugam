import { fireEvent, render, screen } from '@testing-library/react-native'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'

jest.mock('expo-router', () => ({ useLocalSearchParams: jest.fn(), useRouter: jest.fn() }))
jest.mock('../src/features/auth/useMobileProtectedRoute', () => ({ useMobileProtectedRoute: jest.fn() }))

import { useLocalSearchParams, useRouter } from 'expo-router'

import { useMobileProtectedRoute } from '../src/features/auth/useMobileProtectedRoute'
import BookDiscoveryRoute from '../app/rooms/[roomId]/books/new'

const roomId = '00000000-0000-4000-8000-000000000001'
const mockUseLocalSearchParams = jest.mocked(useLocalSearchParams)
const mockUseMobileProtectedRoute = jest.mocked(useMobileProtectedRoute)
const mockUseRouter = jest.mocked(useRouter)

describe('BookDiscoveryRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseMobileProtectedRoute.mockReturnValue(true)
    mockUseLocalSearchParams.mockReturnValue({ roomId } as never)
    mockUseRouter.mockReturnValue({ replace: jest.fn() } as never)
  })

  it('does not open book discovery when the room path is not a UUID', () => {
    const replace = jest.fn()
    mockUseLocalSearchParams.mockReturnValue({ roomId: 'not-a-uuid' } as never)
    mockUseRouter.mockReturnValue({ replace } as never)

    render(<BookDiscoveryRoute />)

    expect(screen.getByText('이 책방을 찾을 수 없어요')).toBeVisible()
    fireEvent.press(screen.getByRole('button', { name: '내 책방으로' }))
    expect(replace).toHaveBeenCalledWith('/rooms')
  })
})
