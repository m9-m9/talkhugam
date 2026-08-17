import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { readingRoomKeys } from '@talkhugam/domain'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import type { PropsWithChildren } from 'react'

jest.mock('../src/entities/reading-room')
jest.mock('../src/shared/api/mobileSupabaseClient')

import { joinMobileRoomByCode } from '../src/entities/reading-room'
import { JoinRoomScreen } from '../src/features/reading-room/JoinRoomScreen'
import { createMobileSupabaseClient } from '../src/shared/api/mobileSupabaseClient'

const mockJoinMobileRoomByCode = jest.mocked(joinMobileRoomByCode)
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

describe('JoinRoomScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCreateMobileSupabaseClient.mockReturnValue({} as never)
  })

  it('uses a valid invite-link token without exposing it as an editable code', () => {
    render(<JoinRoomScreen inviteToken={'a'.repeat(64)} onJoined={jest.fn()} />, {
      wrapper: createQueryWrapper(),
    })

    expect(screen.queryByLabelText('6자리 초대 코드')).toBeNull()
    expect(screen.getByRole('button', { name: '초대받은 책방에 참여하기' })).toBeVisible()
  })

  it('normalizes a typed invite code before joining and returns to the room list', async () => {
    mockJoinMobileRoomByCode.mockResolvedValue('00000000-0000-4000-8000-000000000001')
    const onJoined = jest.fn()
    render(<JoinRoomScreen inviteToken={null} onJoined={onJoined} />, {
      wrapper: createQueryWrapper(),
    })
    fireEvent.changeText(screen.getByLabelText('6자리 초대 코드'), 'talk87')
    fireEvent.press(screen.getByRole('button', { name: '함께 읽기 시작하기' }))

    await waitFor(() => {
      expect(mockJoinMobileRoomByCode).toHaveBeenCalledWith({}, { code: 'TALK87' })
      expect(onJoined).toHaveBeenCalledTimes(1)
    })
  })

  it('announces a retryable message when an invite cannot be accepted', async () => {
    mockJoinMobileRoomByCode.mockRejectedValue(new Error('expired'))
    render(<JoinRoomScreen inviteToken={null} onJoined={jest.fn()} />, {
      wrapper: createQueryWrapper(),
    })
    fireEvent.changeText(screen.getByLabelText('6자리 초대 코드'), 'TALK87')
    fireEvent.press(screen.getByRole('button', { name: '함께 읽기 시작하기' }))

    expect(
      await screen.findByRole('alert', {
        name: '앗, 이 코드로는 못 들어가요. 만료됐거나 잘못 입력된 코드 같아요.',
      }),
    ).toBeVisible()
  })

  it('invalidates the protected room list after joining by an invite', async () => {
    const queryClient = createQueryClient()
    queryClient.setQueryData(readingRoomKeys.all, [])
    mockJoinMobileRoomByCode.mockResolvedValue('00000000-0000-4000-8000-000000000001')
    render(<JoinRoomScreen inviteToken={'a'.repeat(64)} onJoined={jest.fn()} />, {
      wrapper: createQueryWrapper(queryClient),
    })
    fireEvent.press(screen.getByRole('button', { name: '초대받은 책방에 참여하기' }))

    await waitFor(() => {
      expect(queryClient.getQueryState(readingRoomKeys.all)?.isInvalidated).toBe(true)
    })
  })

  it('submits the latest invite-link token without copying it into component state', async () => {
    const firstToken = 'a'.repeat(64)
    const latestToken = 'b'.repeat(64)
    mockJoinMobileRoomByCode.mockResolvedValue('00000000-0000-4000-8000-000000000001')
    const renderedScreen = render(
      <JoinRoomScreen inviteToken={firstToken} onJoined={jest.fn()} />,
      { wrapper: createQueryWrapper() },
    )

    renderedScreen.rerender(<JoinRoomScreen inviteToken={latestToken} onJoined={jest.fn()} />)
    fireEvent.press(screen.getByRole('button', { name: '초대받은 책방에 참여하기' }))

    await waitFor(() => {
      expect(mockJoinMobileRoomByCode).toHaveBeenCalledWith({}, { code: latestToken })
    })
  })
})
