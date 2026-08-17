import { act, render, screen, waitFor } from '@testing-library/react-native'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { Text } from 'react-native'

jest.mock('../src/shared/api/mobileSupabaseClient')

import {
  MobileAppProviders,
  useMobileSessionProfileId,
} from '../src/shared/api/MobileAppProviders'
import { createMobileSupabaseClient } from '../src/shared/api/mobileSupabaseClient'

const profileId = '00000000-0000-4000-8000-000000000001'
const mockCreateMobileSupabaseClient = jest.mocked(createMobileSupabaseClient)

/** 현재 Provider가 보관한 프로필 식별자를 화면 텍스트로 관찰한다. */
function SessionProfileProbe(): React.JSX.Element {
  const currentProfileId = useMobileSessionProfileId()

  return <Text>{currentProfileId ?? '로그아웃'}</Text>
}

describe('MobileAppProviders', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('keeps the newer auth event when the older initial user lookup finishes afterwards', async () => {
    let authListener: ((event: string, session: unknown) => void) | undefined
    let resolveInitialUser: ((response: unknown) => void) | undefined
    const initialUserResponse = new Promise<unknown>((resolve) => {
      resolveInitialUser = resolve
    })
    mockCreateMobileSupabaseClient.mockReturnValue({
      auth: {
        getUser: () => initialUserResponse,
        onAuthStateChange: (listener: (event: string, session: unknown) => void) => {
          authListener = listener
          return { data: { subscription: { unsubscribe: jest.fn() } } }
        },
      },
    } as never)

    render(
      <MobileAppProviders>
        <SessionProfileProbe />
      </MobileAppProviders>,
    )

    await waitFor(() => expect(authListener).toBeDefined())
    act(() => {
      authListener?.('SIGNED_IN', { user: { id: profileId } })
    })
    expect(screen.getByText(profileId)).toBeVisible()

    await act(async () => {
      resolveInitialUser?.({ data: { user: null }, error: null })
      await initialUserResponse
    })

    expect(screen.getByText(profileId)).toBeVisible()
  })
})
