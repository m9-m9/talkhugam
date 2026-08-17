import { fireEvent, render, screen } from '@testing-library/react-native'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'

jest.mock('expo-router', () => ({ useLocalSearchParams: jest.fn(), useRouter: jest.fn() }))
jest.mock('../src/features/auth/useMobileProtectedRoute', () => ({ useMobileProtectedRoute: jest.fn() }))

import { useLocalSearchParams, useRouter } from 'expo-router'

import { useMobileProtectedRoute } from '../src/features/auth/useMobileProtectedRoute'
import BookChatRouteShell from '../app/rooms/[roomId]/books/[bookChatId]'

const mockUseLocalSearchParams = jest.mocked(useLocalSearchParams)
const mockUseMobileProtectedRoute = jest.mocked(useMobileProtectedRoute)
const mockUseRouter = jest.mocked(useRouter)
const roomId = '00000000-0000-4000-8000-000000000001'
const bookChatId = '00000000-0000-4000-8000-000000000002'

describe('BookChatRouteShell', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseMobileProtectedRoute.mockReturnValue(true)
    mockUseRouter.mockReturnValue({ replace: jest.fn() } as never)
    mockUseLocalSearchParams.mockReturnValue({ bookChatId, roomId } as never)
  })

  it('shows a safe rooms return action when the room identifier is not a UUID', () => {
    const replace = jest.fn()
    mockUseRouter.mockReturnValue({ replace } as never)
    mockUseLocalSearchParams.mockReturnValue({ bookChatId, roomId: 'not-a-uuid' } as never)

    render(<BookChatRouteShell />)

    expect(screen.getByText('이 책 대화를 찾을 수 없어요')).toBeVisible()
    fireEvent.press(screen.getByRole('button', { name: '내 책방으로' }))
    expect(replace).toHaveBeenCalledWith('/rooms')
  })

  it('shows a safe rooms return action when the book conversation identifier is not a UUID', () => {
    const replace = jest.fn()
    mockUseRouter.mockReturnValue({ replace } as never)
    mockUseLocalSearchParams.mockReturnValue({ bookChatId: 'not-a-uuid', roomId } as never)

    render(<BookChatRouteShell />)

    expect(screen.getByText('이 책 대화를 찾을 수 없어요')).toBeVisible()
    fireEvent.press(screen.getByRole('button', { name: '내 책방으로' }))
    expect(replace).toHaveBeenCalledWith('/rooms')
  })
})
