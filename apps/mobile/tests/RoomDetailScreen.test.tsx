import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import type { PropsWithChildren } from 'react'

jest.mock('../src/entities/reading-room')
jest.mock('../src/shared/api/mobileSupabaseClient')

import {
  getMobileBookChats,
  getMobileReadingRoomDetail,
} from '../src/entities/reading-room'
import { MobileRoomDetailScreen } from '../src/features/reading-room/MobileRoomDetailScreen'
import { createMobileSupabaseClient } from '../src/shared/api/mobileSupabaseClient'

const mockGetMobileBookChats = jest.mocked(getMobileBookChats)
const mockGetMobileReadingRoomDetail = jest.mocked(getMobileReadingRoomDetail)
const mockCreateMobileSupabaseClient = jest.mocked(createMobileSupabaseClient)
const roomId = '00000000-0000-4000-8000-000000000001'
const bookChatId = '00000000-0000-4000-8000-000000000002'

/** 화면 상태를 서로 격리할 Query Client를 생성한다. */
function createQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } })
}

/** 실제 서버 상태 Provider를 화면 테스트에 제공하는 래퍼를 반환한다. */
function createQueryWrapper(
  queryClient = createQueryClient(),
): ({ children }: PropsWithChildren) => React.JSX.Element {
  /** 테스트마다 독립된 query cache를 사용한다. */
  return function QueryWrapper({ children }: PropsWithChildren): React.JSX.Element {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('MobileRoomDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCreateMobileSupabaseClient.mockReturnValue({} as never)
  })

  it('opens the selected book conversation after loading its protected room and books', async () => {
    mockGetMobileReadingRoomDetail.mockResolvedValue({
      description: '이번 달의 책',
      id: roomId,
      name: '금요일 아침 책방',
    })
    mockGetMobileBookChats.mockResolvedValue([
      {
        authors: ['기시미 이치로'],
        id: bookChatId,
        name: '미움받을 용기',
        thumbnailUrl: null,
        title: '미움받을 용기',
      },
    ])
    const onOpenBookChat = jest.fn()

    render(
      <MobileRoomDetailScreen
        onBack={jest.fn()}
        onOpenBookChat={onOpenBookChat}
        roomId={roomId}
      />,
      { wrapper: createQueryWrapper() },
    )

    expect(await screen.findByText('금요일 아침 책방')).toBeVisible()
    fireEvent.press(await screen.findByRole('button', { name: '미움받을 용기 대화 열기' }))
    expect(onOpenBookChat).toHaveBeenCalledWith(bookChatId)
  })

  it('returns to my rooms when RLS hides a room outside the member boundary', async () => {
    mockGetMobileReadingRoomDetail.mockResolvedValue(null)
    const onBack = jest.fn()

    render(<MobileRoomDetailScreen onBack={onBack} onOpenBookChat={jest.fn()} roomId={roomId} />, {
      wrapper: createQueryWrapper(),
    })

    expect(await screen.findByText('이 책방을 찾을 수 없어요')).toBeVisible()
    fireEvent.press(screen.getByRole('button', { name: '내 책방으로' }))
    expect(onBack).toHaveBeenCalledTimes(1)
    expect(mockGetMobileBookChats).not.toHaveBeenCalled()
  })

  it('retries the room lookup when it fails without treating the member-visible room as missing', async () => {
    mockGetMobileReadingRoomDetail
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce({ description: null, id: roomId, name: '금요일 아침 책방' })
    mockGetMobileBookChats.mockResolvedValue([])

    render(<MobileRoomDetailScreen onBack={jest.fn()} onOpenBookChat={jest.fn()} roomId={roomId} />, {
      wrapper: createQueryWrapper(),
    })

    expect(
      await screen.findByRole('alert', { name: '책방을 불러오지 못했어요. 다시 시도해 주세요.' }),
    ).toBeVisible()
    fireEvent.press(screen.getByRole('button', { name: '다시 시도' }))
    await waitFor(() => expect(mockGetMobileReadingRoomDetail).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('금요일 아침 책방')).toBeVisible()
  })

  it('offers retry when the protected book list request fails after room access succeeds', async () => {
    mockGetMobileReadingRoomDetail.mockResolvedValue({
      description: null,
      id: roomId,
      name: '금요일 아침 책방',
    })
    mockGetMobileBookChats.mockRejectedValueOnce(new Error('network unavailable')).mockResolvedValueOnce([])

    render(<MobileRoomDetailScreen onBack={jest.fn()} onOpenBookChat={jest.fn()} roomId={roomId} />, {
      wrapper: createQueryWrapper(),
    })

    expect(
      await screen.findByRole('alert', { name: '책 목록을 불러오지 못했어요. 다시 시도해 주세요.' }),
    ).toBeVisible()
    fireEvent.press(screen.getByRole('button', { name: '다시 시도' }))
    await waitFor(() => expect(mockGetMobileBookChats).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('아직 함께 읽는 책이 없어요.')).toBeVisible()
  })
})
