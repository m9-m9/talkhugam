import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { describe, expect, it, jest } from '@jest/globals'
import type { PropsWithChildren } from 'react'

import { MobileCommunityRoomsScreen } from '../src/features/community/MobileCommunityRoomsScreen'

/** 오픈 책방 화면에 격리된 서버 캐시를 제공한다. */
function QueryWrapper({ children }: PropsWithChildren): React.JSX.Element {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { gcTime: Infinity },
      queries: { gcTime: Infinity, retry: false },
    },
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('MobileCommunityRoomsScreen', () => {
  it('팔로우한 사람이 연 오픈 책방을 먼저 표시하고 참여 흐름을 연다', async () => {
    /** 발견 목록을 외부 네트워크 없이 고정된 오픈 책방으로 제공한다. */
    async function loadRooms() {
      return [{ access: 'password' as const, activeMemberCount: 2, capacity: 10, createdBy: '11111111-1111-4111-8111-111111111111', description: '함께 읽어요', id: '22222222-2222-4222-8222-222222222222', isFollowingCreator: true, name: '주말 독서회' }]
    }
    const onJoinRoom = jest.fn()

    render(<MobileCommunityRoomsScreen loadRooms={loadRooms} onCreateRoom={jest.fn()} onJoinRoom={onJoinRoom} />, { wrapper: QueryWrapper })

    expect(await screen.findByText('팔로우한 사람이 열었어요')).toBeVisible()
    fireEvent.press(screen.getByRole('button', { name: '주말 독서회 참여하기' }))
    expect(onJoinRoom).toHaveBeenCalledWith('22222222-2222-4222-8222-222222222222', true)
  })
})
