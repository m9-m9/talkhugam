import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react-native'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import type { PropsWithChildren } from 'react'

jest.mock('../src/entities/community')
jest.mock('../src/entities/profile')
jest.mock('../src/shared/api/mobileSupabaseClient')

import { getMobileCommunityMessages, getMobileCommunityRoom } from '../src/entities/community'
import { MobileCommunityRoomDetailScreen } from '../src/features/community/MobileCommunityEntryScreens'
import { createMobileSupabaseClient } from '../src/shared/api/mobileSupabaseClient'

const mockGetRoom = jest.mocked(getMobileCommunityRoom)
const mockGetMessages = jest.mocked(getMobileCommunityMessages)
const mockCreateClient = jest.mocked(createMobileSupabaseClient)
const roomId = '11111111-1111-4111-8111-111111111111'

/** 테스트마다 독립된 query cache로 화면을 감싸는 래퍼를 만든다. */
function createQueryWrapper(): ({ children }: PropsWithChildren) => React.JSX.Element {
  const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } })
  /** 화면에 서버 상태 Provider를 제공한다. */
  return function QueryWrapper({ children }: PropsWithChildren): React.JSX.Element {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('MobileCommunityRoomDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCreateClient.mockReturnValue({} as never)
    mockGetMessages.mockResolvedValue([
      { body: '방장 공지', createdAt: '2026-10-27T00:00:00.000Z', id: '44444444-4444-4444-8444-444444444441', senderDisplayName: '방장', senderMemberId: '55555555-5555-4555-8555-555555555551', senderRole: 'owner' },
      { body: '운영 안내', createdAt: '2026-10-27T00:01:00.000Z', id: '44444444-4444-4444-8444-444444444442', senderDisplayName: '다른 운영자', senderMemberId: '55555555-5555-4555-8555-555555555552', senderRole: 'manager' },
      { body: '반가워요', createdAt: '2026-10-27T00:02:00.000Z', id: '44444444-4444-4444-8444-444444444443', senderDisplayName: '참여자', senderMemberId: '55555555-5555-4555-8555-555555555553', senderRole: 'member' },
    ])
  })

  it('운영자에게는 참여자 메시지에만 퇴장·차단을 보여 준다', async () => {
    mockGetRoom.mockResolvedValue({ currentMemberId: '33333333-3333-4333-8333-333333333333', currentMemberRole: 'manager', description: null, id: roomId, isOwner: false, name: '주말 독서회' })

    render(<MobileCommunityRoomDetailScreen onBack={jest.fn()} roomId={roomId} />, { wrapper: createQueryWrapper() })

    expect(await screen.findByRole('button', { name: '참여자 퇴장·차단' })).toBeVisible()
    expect(screen.queryByRole('button', { name: '방장 퇴장·차단' })).toBeNull()
    expect(screen.queryByRole('button', { name: '다른 운영자 퇴장·차단' })).toBeNull()
  })

  it('참여자에게는 퇴장·차단을 보여 주지 않는다', async () => {
    mockGetRoom.mockResolvedValue({ currentMemberId: '33333333-3333-4333-8333-333333333333', currentMemberRole: 'member', description: null, id: roomId, isOwner: false, name: '주말 독서회' })

    render(<MobileCommunityRoomDetailScreen onBack={jest.fn()} roomId={roomId} />, { wrapper: createQueryWrapper() })

    expect(await screen.findByText('반가워요')).toBeVisible()
    expect(screen.queryByRole('button', { name: '참여자 퇴장·차단' })).toBeNull()
  })
})
