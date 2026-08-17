import { act, render, waitFor } from '@testing-library/react-native'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import type { QueryClient } from '@tanstack/react-query'

let mockCapturedQueryClient: QueryClient | undefined
let mockSessionListener: ((event: string, session: unknown) => void) | undefined

jest.mock('expo-router', () => {
  const reactQuery = jest.requireActual(
    '@tanstack/react-query',
  ) as typeof import('@tanstack/react-query')

  /** Query Provider 내부의 테스트용 캐시 참조를 보관한다. */
  function MockStack(): null {
    mockCapturedQueryClient = reactQuery.useQueryClient()
    return null
  }

  return { Stack: MockStack }
})
jest.mock('../src/shared/api/mobileSupabaseClient')

import { createMobileSupabaseClient } from '../src/shared/api/mobileSupabaseClient'

import RootLayout from '../app/_layout'

const profileId = '00000000-0000-4000-8000-000000000001'
const mockCreateMobileSupabaseClient = jest.mocked(createMobileSupabaseClient)

describe('RootLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCapturedQueryClient = undefined
    mockSessionListener = undefined
  })

  it('clears private query data when the authenticated account changes or signs out', async () => {
    const unsubscribe = jest.fn()
    const onAuthStateChange = jest.fn((listener: (event: string, session: unknown) => void) => {
      mockSessionListener = listener
      return { data: { subscription: { unsubscribe } } }
    })
    mockCreateMobileSupabaseClient.mockReturnValue({
      auth: {
        getUser: async () => ({ data: { user: { id: profileId } }, error: null }),
        onAuthStateChange,
      },
    } as never)

    const screen = render(<RootLayout />)

    await waitFor(() => expect(onAuthStateChange).toHaveBeenCalledTimes(1))
    const queryClient = mockCapturedQueryClient
    if (!queryClient) throw new Error('Query Client를 찾지 못했어요.')

    queryClient.setQueryData(['reading-rooms', profileId], [{ name: '이전 계정의 비공개 책방' }])
    act(() => {
      mockSessionListener?.('SIGNED_OUT', null)
    })

    expect(queryClient.getQueryData(['reading-rooms', profileId])).toBeUndefined()
    screen.unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })
})
