import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { readingRoomKeys } from '@talkhugam/domain'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import type { PropsWithChildren } from 'react'

jest.mock('../src/entities/reading-room')
jest.mock('../src/shared/api/mobileSupabaseClient')

import { createMobileRoomWithInvite } from '../src/entities/reading-room'
import { CreateRoomScreen } from '../src/features/reading-room/CreateRoomScreen'
import { createMobileSupabaseClient } from '../src/shared/api/mobileSupabaseClient'

const mockCreateMobileRoomWithInvite = jest.mocked(createMobileRoomWithInvite)
const mockCreateMobileSupabaseClient = jest.mocked(createMobileSupabaseClient)

/** 화면별 비공개 책방 캐시 상태를 검증할 Query Client를 생성한다. */
function createQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } })
}

/** 화면에 독립적인 Query Client를 주입하는 테스트 래퍼를 반환한다. */
function createQueryWrapper(
  queryClient = createQueryClient(),
): ({ children }: PropsWithChildren) => React.JSX.Element {
  /** 테스트 화면을 실제 Query Provider로 감싼다. */
  return function QueryWrapper({ children }: PropsWithChildren): React.JSX.Element {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('CreateRoomScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCreateMobileSupabaseClient.mockReturnValue({} as never)
  })

  it('does not send an invalid room creation request', () => {
    render(<CreateRoomScreen onFinished={jest.fn()} />, { wrapper: createQueryWrapper() })

    fireEvent.press(screen.getByRole('button', { name: '책방 만들기' }))

    expect(screen.getByRole('alert', { name: '책방 이름을 입력해 주세요.' })).toBeVisible()
    expect(mockCreateMobileRoomWithInvite).not.toHaveBeenCalled()
  })

  it('shows the generated invite code once after the protected create RPC succeeds', async () => {
    mockCreateMobileRoomWithInvite.mockResolvedValue({
      code: 'TALK87',
      expiresAt: '2026-08-19T00:00:00.000Z',
      roomId: '00000000-0000-4000-8000-000000000001',
      token: 'a'.repeat(64),
    })

    render(<CreateRoomScreen onFinished={jest.fn()} />, { wrapper: createQueryWrapper() })
    fireEvent.changeText(screen.getByLabelText('책방 이름'), '금요일 아침 책방')
    fireEvent.changeText(screen.getByLabelText('한 줄 소개'), '이번 달 함께 읽는 책들')
    fireEvent.press(screen.getByRole('button', { name: '책방 만들기' }))

    expect(await screen.findByText('TALK87')).toBeVisible()
    expect(screen.getByText('지금 한 번만 확인할 수 있는 초대 코드예요.')).toBeVisible()
    expect(mockCreateMobileRoomWithInvite).toHaveBeenCalledWith(
      {},
      {
        description: '이번 달 함께 읽는 책들',
        name: '금요일 아침 책방',
      },
    )
  })

  it('keeps the creation form available after a server failure', async () => {
    mockCreateMobileRoomWithInvite.mockRejectedValue(new Error('unavailable'))
    render(<CreateRoomScreen onFinished={jest.fn()} />, { wrapper: createQueryWrapper() })
    fireEvent.changeText(screen.getByLabelText('책방 이름'), '금요일 아침 책방')
    fireEvent.press(screen.getByRole('button', { name: '책방 만들기' }))

    expect(
      await screen.findByRole('alert', {
        name: '책방을 만들지 못했어요. 잠시 후 다시 시도해 주세요.',
      }),
    ).toBeVisible()
    expect(screen.getByLabelText('책방 이름')).toBeVisible()
  })

  it('invalidates the protected room list after creating a room', async () => {
    const queryClient = createQueryClient()
    queryClient.setQueryData(readingRoomKeys.all, [])
    mockCreateMobileRoomWithInvite.mockResolvedValue({
      code: 'TALK87',
      expiresAt: '2026-08-19T00:00:00.000Z',
      roomId: '00000000-0000-4000-8000-000000000001',
      token: 'a'.repeat(64),
    })
    render(<CreateRoomScreen onFinished={jest.fn()} />, {
      wrapper: createQueryWrapper(queryClient),
    })
    fireEvent.changeText(screen.getByLabelText('책방 이름'), '금요일 아침 책방')
    fireEvent.press(screen.getByRole('button', { name: '책방 만들기' }))

    await screen.findByText('TALK87')
    await waitFor(() => {
      expect(queryClient.getQueryState(readingRoomKeys.all)?.isInvalidated).toBe(true)
    })
  })
})
