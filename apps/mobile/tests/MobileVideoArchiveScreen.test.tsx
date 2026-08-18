import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import type { PropsWithChildren } from 'react'

jest.mock('../src/entities/video')
jest.mock('../src/shared/api/mobileSupabaseClient')

import { getMobileVideoFilterMembers, getMobileVideoPosts } from '../src/entities/video'
import { MobileVideoArchiveScreen } from '../src/features/video/MobileVideoArchiveScreen'
import { createMobileSupabaseClient } from '../src/shared/api/mobileSupabaseClient'

const roomId = '00000000-0000-4000-8000-000000000001'
const bookChatId = '00000000-0000-4000-8000-000000000002'
const videoId = '00000000-0000-4000-8000-000000000003'

const mockGetMobileVideoFilterMembers = jest.mocked(getMobileVideoFilterMembers)
const mockGetMobileVideoPosts = jest.mocked(getMobileVideoPosts)
const mockCreateMobileSupabaseClient = jest.mocked(createMobileSupabaseClient)

/** 화면별 서버 캐시를 격리하는 Query Client를 반환한다. */
function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      mutations: { gcTime: Infinity, retry: false },
      queries: { gcTime: Infinity, retry: false },
    },
  })
}

/** 테스트 화면에 React Query provider를 주입하는 래퍼를 반환한다. */
function createQueryWrapper(): ({ children }: PropsWithChildren) => React.JSX.Element {
  const queryClient = createQueryClient()
  return function QueryWrapper({ children }: PropsWithChildren): React.JSX.Element {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('MobileVideoArchiveScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCreateMobileSupabaseClient.mockReturnValue({} as never)
    mockGetMobileVideoFilterMembers.mockResolvedValue([{ displayName: '민규', id: 'member-1', isCurrentUser: true }])
    mockGetMobileVideoPosts.mockResolvedValue([
      {
        authorMemberId: 'member-1', authorName: '민규', body: null,
        createdAt: '2026-08-18T01:00:00.000+00:00', id: videoId, status: 'ready',
      },
    ])
  })

  it('shows ready video records, filters them, and opens the selected record', async () => {
    const onOpenVideo = jest.fn()
    render(<MobileVideoArchiveScreen bookChatId={bookChatId} onBack={jest.fn()} onOpenVideo={onOpenVideo} roomId={roomId} />, { wrapper: createQueryWrapper() })

    expect(await screen.findByText('민규의 영상')).toBeVisible()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '내 영상' })).toBeEnabled()
    })
    fireEvent.press(screen.getByRole('button', { name: '내 영상' }))
    fireEvent.press(screen.getByRole('button', { name: '민규의 영상 열기' }))

    expect(onOpenVideo).toHaveBeenCalledWith(videoId)
  })

  it('shows a retry action when video records fail to load', async () => {
    mockGetMobileVideoPosts.mockRejectedValue(new Error('network'))
    render(<MobileVideoArchiveScreen bookChatId={bookChatId} onBack={jest.fn()} onOpenVideo={jest.fn()} roomId={roomId} />, { wrapper: createQueryWrapper() })

    expect(await screen.findByRole('alert')).toHaveTextContent('영상 기록을 불러오지 못했어요. 다시 시도해 주세요.')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '내 영상' })).toBeEnabled()
    })
    fireEvent.press(screen.getByRole('button', { name: '영상 기록 다시 시도' }))
    await waitFor(() => expect(mockGetMobileVideoPosts).toHaveBeenCalledTimes(2))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('영상 기록을 불러오지 못했어요. 다시 시도해 주세요.')
    })
  })
})
