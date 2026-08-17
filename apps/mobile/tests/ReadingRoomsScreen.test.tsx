import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { readingRoomKeys } from '@talkhugam/domain'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import type { PropsWithChildren } from 'react'

jest.mock('../src/entities/reading-room')
jest.mock('../src/shared/api/mobileSupabaseClient')
jest.mock('../src/shared/api/MobileAppProviders', () => ({ useMobileSessionProfileId: jest.fn() }))

import { getMobileReadingRooms } from '../src/entities/reading-room'
import { MobileReadingRoomsScreen } from '../src/features/reading-room/MobileReadingRoomsScreen'
import { useMobileSessionProfileId } from '../src/shared/api/MobileAppProviders'
import { createMobileSupabaseClient } from '../src/shared/api/mobileSupabaseClient'

const mockGetMobileReadingRooms = jest.mocked(getMobileReadingRooms)
const mockCreateMobileSupabaseClient = jest.mocked(createMobileSupabaseClient)
const mockUseMobileSessionProfileId = jest.mocked(useMobileSessionProfileId)
const profileId = '00000000-0000-4000-8000-000000000001'
const otherProfileId = '00000000-0000-4000-8000-000000000002'
const room = {
  createdAt: '2026-08-18T00:00:00.000Z',
  description: null,
  id: '00000000-0000-4000-8000-000000000001',
  lastMessage: null,
  members: [{ displayName: '민규', joinedAt: '2026-08-18T00:00:00.000Z' }],
  name: '금요일 아침 책방',
  updatedAt: '2026-08-18T00:00:00.000Z',
}

/** 실제 캐시 없이 화면별 서버 상태를 검증할 Query Provider를 반환한다. */
function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false, staleTime: Infinity } },
  })
}

/** 테스트 화면에만 독립된 Query Client를 제공하는 래퍼를 반환한다. */
function createQueryWrapper(
  queryClient = createQueryClient(),
): ({ children }: PropsWithChildren) => React.JSX.Element {
  /** 테스트 화면에만 독립된 Query Client를 제공한다. */
  return function QueryWrapper({ children }: PropsWithChildren): React.JSX.Element {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('MobileReadingRoomsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCreateMobileSupabaseClient.mockReturnValue({} as never)
    mockUseMobileSessionProfileId.mockReturnValue(profileId)
  })

  it('announces the first protected room query while it is loading', () => {
    mockGetMobileReadingRooms.mockReturnValue(new Promise(() => undefined))

    render(<MobileReadingRoomsScreen onCreateRoom={jest.fn()} onJoinRoom={jest.fn()} onOpenRoom={jest.fn()} />, {
      wrapper: createQueryWrapper(),
    })

    expect(screen.getByLabelText('책방을 준비하고 있어요.')).toBeVisible()
  })

  it('guides a member with no rooms toward creating or joining one', async () => {
    mockGetMobileReadingRooms.mockResolvedValue([])
    const onCreateRoom = jest.fn()
    const onJoinRoom = jest.fn()

    render(<MobileReadingRoomsScreen onCreateRoom={onCreateRoom} onJoinRoom={onJoinRoom} onOpenRoom={jest.fn()} />, {
      wrapper: createQueryWrapper(),
    })

    expect(await screen.findByText('아직 함께 읽는 책방이 없어요.')).toBeVisible()
    fireEvent.press(screen.getByRole('button', { name: '새 책방 만들기' }))
    fireEvent.press(screen.getByRole('button', { name: '초대 코드로 참여' }))
    expect(onCreateRoom).toHaveBeenCalledTimes(1)
    expect(onJoinRoom).toHaveBeenCalledTimes(1)
  })

  it('shows a retryable error when protected room retrieval fails', async () => {
    mockGetMobileReadingRooms.mockRejectedValue(new Error('network unavailable'))

    render(<MobileReadingRoomsScreen onCreateRoom={jest.fn()} onJoinRoom={jest.fn()} onOpenRoom={jest.fn()} />, {
      wrapper: createQueryWrapper(),
    })

    expect(
      await screen.findByRole('alert', { name: '책방을 불러오지 못했어요. 다시 시도해 주세요.' }),
    ).toBeVisible()
    fireEvent.press(screen.getByRole('button', { name: '다시 시도' }))
    await waitFor(() => expect(mockGetMobileReadingRooms).toHaveBeenCalledTimes(2))
  })

  it('renders a member-scoped room card with its invite-only summary', async () => {
    mockGetMobileReadingRooms.mockResolvedValue([room])
    const onOpenRoom = jest.fn()

    render(
      <MobileReadingRoomsScreen
        onCreateRoom={jest.fn()}
        onJoinRoom={jest.fn()}
        onOpenRoom={onOpenRoom}
      />,
      {
      wrapper: createQueryWrapper(),
      },
    )

    expect(await screen.findByText('금요일 아침 책방')).toBeVisible()
    expect(screen.getByText('민규 · 1명')).toBeVisible()
    expect(screen.getByText('아직 첫 이야기를 기다리고 있어요.')).toBeVisible()
    fireEvent.press(screen.getByRole('button', { name: '금요일 아침 책방 열기' }))
    expect(onOpenRoom).toHaveBeenCalledWith(room.id)
  })

  it('does not reuse another account’s private room cache after the session identity changes', async () => {
    const queryClient = createQueryClient()
    const previousAccountRoom = { ...room, name: '이전 계정의 비공개 책방' }
    const currentAccountRoom = {
      ...room,
      id: '00000000-0000-4000-8000-000000000002',
      name: '현재 계정의 책방',
    }
    queryClient.setQueryData(readingRoomKeys.all, [previousAccountRoom])
    mockUseMobileSessionProfileId.mockReturnValue(otherProfileId)
    mockGetMobileReadingRooms.mockResolvedValue([currentAccountRoom])

    render(<MobileReadingRoomsScreen onCreateRoom={jest.fn()} onJoinRoom={jest.fn()} onOpenRoom={jest.fn()} />, {
      wrapper: createQueryWrapper(queryClient),
    })

    expect(await screen.findByText('현재 계정의 책방')).toBeVisible()
    expect(screen.queryByText('이전 계정의 비공개 책방')).toBeNull()
  })
})
