import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { bookRatingKeys, readingRoomKeys } from '@talkhugam/domain'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import type { PropsWithChildren } from 'react'

jest.mock('../src/entities/post')
jest.mock('../src/entities/book-rating')
jest.mock('../src/entities/reading-room')
jest.mock('../src/shared/api/mobileSupabaseClient')
jest.mock('../src/shared/api/MobileAppProviders', () => ({
  useMobileSessionProfileId: jest.fn(),
}))

import {
  createMobileDiscussionPost,
  createMobileDiscussionReply,
  getMobileDiscussionMembers,
  getMobileDiscussionPosts,
} from '../src/entities/post'
import {
  getMobileBookChatRatings,
  removeMobileBookChatRating,
  upsertMobileBookChatRating,
} from '../src/entities/book-rating'
import { getMobileDiscussionBookChat } from '../src/entities/reading-room'
import { MobileBookDiscussionScreen } from '../src/features/reading-room/MobileBookDiscussionScreen'
import { createMobileSupabaseClient } from '../src/shared/api/mobileSupabaseClient'
import { useMobileSessionProfileId } from '../src/shared/api/MobileAppProviders'

const roomId = '3f1c2a4e-7b5d-4e6a-9c8b-1a2b3c4d5e01'
const bookChatId = '3f1c2a4e-7b5d-4e6a-9c8b-1a2b3c4d5e02'
const rootPostId = '3f1c2a4e-7b5d-4e6a-9c8b-1a2b3c4d5e03'
const firstMemberId = '3f1c2a4e-7b5d-4e6a-9c8b-1a2b3c4d5e04'
const secondMemberId = '3f1c2a4e-7b5d-4e6a-9c8b-1a2b3c4d5e05'
const submissionClientId = '3f1c2a4e-7b5d-4e6a-9c8b-1a2b3c4d5e06'

const mockCreateMobileDiscussionPost = jest.mocked(createMobileDiscussionPost)
const mockCreateMobileDiscussionReply = jest.mocked(createMobileDiscussionReply)
const mockGetMobileBookChatRatings = jest.mocked(getMobileBookChatRatings)
const mockGetMobileDiscussionBookChat = jest.mocked(getMobileDiscussionBookChat)
const mockGetMobileDiscussionMembers = jest.mocked(getMobileDiscussionMembers)
const mockGetMobileDiscussionPosts = jest.mocked(getMobileDiscussionPosts)
const mockCreateMobileSupabaseClient = jest.mocked(createMobileSupabaseClient)
const mockRemoveMobileBookChatRating = jest.mocked(removeMobileBookChatRating)
const mockUpsertMobileBookChatRating = jest.mocked(upsertMobileBookChatRating)
const mockUseMobileSessionProfileId = jest.mocked(useMobileSessionProfileId)

/** 화면 상태를 격리할 Query Client를 생성한다. */
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

/** 읽기 가능한 책 대화와 빈 타임라인을 기본으로 설정한다. */
function mockReadableDiscussion(): void {
  mockGetMobileDiscussionBookChat.mockResolvedValue({
    id: bookChatId,
    name: '미움받을 용기',
    roomId,
    status: 'reading',
    thumbnailUrl: null,
    title: '미움받을 용기',
  })
  mockGetMobileDiscussionPosts.mockResolvedValue([])
  mockGetMobileDiscussionMembers.mockResolvedValue([])
}

describe('MobileBookDiscussionScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCreateMobileSupabaseClient.mockReturnValue({} as never)
    mockCreateMobileDiscussionPost.mockResolvedValue(rootPostId)
    mockCreateMobileDiscussionReply.mockResolvedValue(rootPostId)
    mockGetMobileBookChatRatings.mockResolvedValue([])
    mockRemoveMobileBookChatRating.mockResolvedValue()
    mockUpsertMobileBookChatRating.mockResolvedValue()
    mockUseMobileSessionProfileId.mockReturnValue(firstMemberId)
    Object.defineProperty(global, 'crypto', {
      configurable: true,
      value: { randomUUID: jest.fn(() => submissionClientId) },
    })
    mockReadableDiscussion()
  })

  it('opens the protected video archive from a readable book discussion', async () => {
    const onOpenVideoArchive = jest.fn()
    const queryClient = createQueryClient()
    render(
      <MobileBookDiscussionScreen
        bookChatId={bookChatId}
        onBack={jest.fn()}
        onOpenVideoArchive={onOpenVideoArchive}
        roomId={roomId}
      />,
      { wrapper: createQueryWrapper(queryClient) },
    )

    expect(await screen.findByRole('button', { name: '영상 기록' })).toBeVisible()
    fireEvent.press(screen.getByRole('button', { name: '영상 기록' }))

    await waitFor(() => expect(queryClient.isFetching()).toBe(0))

    expect(onOpenVideoArchive).toHaveBeenCalledTimes(1)
  })

  it('renders one-level replies and identifies duplicate display-name mention candidates by member id', async () => {
    const queryClient = createQueryClient()
    const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries')
    mockGetMobileDiscussionPosts.mockResolvedValue([
      {
        authorMemberId: firstMemberId,
        authorName: '민지',
        body: '첫 번째 감상',
        createdAt: '2026-08-18T01:00:00.000+00:00',
        depth: 0,
        id: rootPostId,
        labels: [{ kind: 'custom', value: '87쪽' }],
        rootPostId: null,
      },
      {
        authorMemberId: secondMemberId,
        authorName: '민지',
        body: '저도 공감해요',
        createdAt: '2026-08-18T01:01:00.000+00:00',
        depth: 1,
        id: '3f1c2a4e-7b5d-4e6a-9c8b-1a2b3c4d5e07',
        labels: [],
        rootPostId,
      },
    ])
    mockGetMobileDiscussionMembers.mockResolvedValue([
      { displayName: '민지', id: firstMemberId, mentionToken: `member-${firstMemberId}` },
      { displayName: '민지', id: secondMemberId, mentionToken: `member-${secondMemberId}` },
    ])

    render(<MobileBookDiscussionScreen bookChatId={bookChatId} onBack={jest.fn()} roomId={roomId} />, {
      wrapper: createQueryWrapper(queryClient),
    })

    expect(await screen.findByText('미움받을 용기')).toBeVisible()
    expect(await screen.findByText('첫 번째 감상')).toBeVisible()
    expect(screen.getByText('저도 공감해요')).toBeVisible()
    expect(screen.getByText('87쪽')).toBeVisible()

    fireEvent.press(screen.getByRole('button', { name: '민지님에게 답글' }))
    fireEvent.changeText(screen.getByLabelText('답글 입력'), '@민')
    fireEvent.press(screen.getByRole('button', { name: `민지 · member-${secondMemberId} 멘션` }))
    fireEvent.changeText(screen.getByLabelText('답글 입력'), `@member-${secondMemberId} 저도 같은 생각이에요`)
    fireEvent.press(screen.getByRole('button', { name: '답글 남기기' }))

    await waitFor(() =>
      expect(mockCreateMobileDiscussionReply).toHaveBeenCalledWith(
        expect.anything(),
        rootPostId,
        submissionClientId,
        {
          body: `@member-${secondMemberId} 저도 같은 생각이에요`,
          labels: [],
          mentionedMemberIds: [secondMemberId],
        },
      ),
    )
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: readingRoomKeys.all })
  })

  it('keeps whitespace and special characters in a display name out of the stored mention token', async () => {
    mockGetMobileDiscussionMembers.mockResolvedValue([
      {
        displayName: '아 이+*#[]',
        id: secondMemberId,
        mentionToken: `member-${secondMemberId}`,
      },
    ])

    render(<MobileBookDiscussionScreen bookChatId={bookChatId} onBack={jest.fn()} roomId={roomId} />, {
      wrapper: createQueryWrapper(),
    })

    expect(await screen.findByText('아직 나눈 이야기가 없어요.')).toBeVisible()
    fireEvent.changeText(screen.getByLabelText('대화 입력'), '@아')
    fireEvent.press(screen.getByRole('button', { name: `아 이+*#[] · member-${secondMemberId} 멘션` }))
    fireEvent.press(screen.getByRole('button', { name: '글 남기기' }))

    await waitFor(() =>
      expect(mockCreateMobileDiscussionPost).toHaveBeenCalledWith(
        expect.anything(),
        bookChatId,
        submissionClientId,
        expect.objectContaining({ mentionedMemberIds: [secondMemberId] }),
      ),
    )
  })

  it('makes archived book discussions read-only while leaving the timeline visible', async () => {
    mockGetMobileDiscussionBookChat.mockResolvedValue({
      id: bookChatId,
      name: '미움받을 용기',
      roomId,
      status: 'archived',
      thumbnailUrl: null,
      title: '미움받을 용기',
    })
    mockGetMobileDiscussionPosts.mockResolvedValue([
      {
        authorMemberId: firstMemberId,
        authorName: '민지',
        body: '마무리한 감상',
        createdAt: '2026-08-18T01:00:00.000+00:00',
        depth: 0,
        id: rootPostId,
        labels: [],
        rootPostId: null,
      },
    ])

    render(<MobileBookDiscussionScreen bookChatId={bookChatId} onBack={jest.fn()} roomId={roomId} />, {
      wrapper: createQueryWrapper(),
    })

    expect(await screen.findByText('마무리한 감상')).toBeVisible()
    expect(screen.getByText('보관된 책 대화')).toBeVisible()
    expect(screen.queryByLabelText('대화 입력')).toBeNull()
    expect(screen.queryByRole('button', { name: '민지님에게 답글' })).toBeNull()
  })

  it('refreshes the profile reading-room summary after a successful post', async () => {
    const queryClient = createQueryClient()
    const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries')

    render(<MobileBookDiscussionScreen bookChatId={bookChatId} onBack={jest.fn()} roomId={roomId} />, {
      wrapper: createQueryWrapper(queryClient),
    })

    expect(await screen.findByText('아직 나눈 이야기가 없어요.')).toBeVisible()
    fireEvent.changeText(screen.getByLabelText('대화 입력'), '새로운 생각')
    fireEvent.press(screen.getByRole('button', { name: '글 남기기' }))

    await waitFor(() =>
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: readingRoomKeys.all }),
    )
  })

  it('shows an empty discussion after the protected book conversation is available', async () => {
    render(<MobileBookDiscussionScreen bookChatId={bookChatId} onBack={jest.fn()} roomId={roomId} />, {
      wrapper: createQueryWrapper(),
    })

    expect(await screen.findByText('아직 나눈 이야기가 없어요.')).toBeVisible()
  })

  it('retries a failed text timeline without presenting it as an RLS-hidden discussion', async () => {
    mockGetMobileDiscussionPosts.mockRejectedValueOnce(new Error('network unavailable')).mockResolvedValueOnce([])

    render(<MobileBookDiscussionScreen bookChatId={bookChatId} onBack={jest.fn()} roomId={roomId} />, {
      wrapper: createQueryWrapper(),
    })

    expect(
      await screen.findByRole('alert', { name: '대화를 불러오지 못했어요. 다시 시도해 주세요.' }),
    ).toBeVisible()
    fireEvent.press(screen.getByRole('button', { name: '다시 시도' }))
    await waitFor(() => expect(mockGetMobileDiscussionPosts).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('아직 나눈 이야기가 없어요.')).toBeVisible()
  })

  it('reuses one client id when a failed root-post submission is retried', async () => {
    mockCreateMobileDiscussionPost
      .mockRejectedValueOnce(new Error('response unavailable'))
      .mockResolvedValueOnce(rootPostId)

    render(<MobileBookDiscussionScreen bookChatId={bookChatId} onBack={jest.fn()} roomId={roomId} />, {
      wrapper: createQueryWrapper(),
    })

    expect(await screen.findByText('아직 나눈 이야기가 없어요.')).toBeVisible()
    fireEvent.changeText(screen.getByLabelText('대화 입력'), '처음 생각')
    fireEvent.press(screen.getByRole('button', { name: '글 남기기' }))

    expect(
      await screen.findByRole('alert', { name: '대화 권한이 없거나 저장하지 못했어요. 다시 시도해 주세요.' }),
    ).toBeVisible()
    fireEvent.press(screen.getByRole('button', { name: '저장 다시 시도' }))
    await waitFor(() => expect(mockCreateMobileDiscussionPost).toHaveBeenCalledTimes(2))
    expect(mockCreateMobileDiscussionPost.mock.calls[0]?.[2]).toBe(submissionClientId)
    expect(mockCreateMobileDiscussionPost.mock.calls[1]?.[2]).toBe(submissionClientId)
  })

  it('opens a rating sheet that cannot save without a rating and saves a rating with a review', async () => {
    const queryClient = createQueryClient()
    const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries')

    render(<MobileBookDiscussionScreen bookChatId={bookChatId} onBack={jest.fn()} roomId={roomId} />, {
      wrapper: createQueryWrapper(queryClient),
    })

    expect(await screen.findByRole('button', { name: '별점' })).toBeVisible()
    fireEvent.press(screen.getByRole('button', { name: '별점' }))
    expect(await screen.findByLabelText('별점 시트')).toBeVisible()
    expect(screen.getByText('아직 평균 별점이 없어요')).toBeVisible()
    fireEvent.press(screen.getByRole('button', { name: '별점 남기기' }))
    fireEvent.press(screen.getByRole('button', { name: '별점 저장' }))
    expect(mockUpsertMobileBookChatRating).not.toHaveBeenCalled()
    expect(
      await screen.findByRole('alert', { name: '별점은 1점부터 5점까지, 총평은 1,000자 이내로 남겨 주세요.' }),
    ).toBeVisible()

    fireEvent.press(screen.getByRole('button', { name: '5점' }))
    fireEvent.changeText(screen.getByLabelText('총평'), ' 오래 남는 문장이 많았어요. ')
    fireEvent.press(screen.getByRole('button', { name: '별점 저장' }))

    await waitFor(() =>
      expect(mockUpsertMobileBookChatRating).toHaveBeenCalledWith(expect.anything(), {
        bookChatId,
        rating: 5,
        review: '오래 남는 문장이 많았어요.',
      }),
    )
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: bookRatingKeys.byChat(bookChatId) })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: bookRatingKeys.myBooks(firstMemberId) })
  })

  it('shows the average and member ratings and prevents archived conversations from editing them', async () => {
    mockGetMobileBookChatRatings.mockResolvedValue([
      {
        avatarPath: null,
        displayName: '민지',
        isMe: false,
        profileId: secondMemberId,
        rating: 4,
        review: '천천히 다시 읽고 싶어요.',
        updatedAt: '2026-08-18T01:00:00.000+00:00',
      },
    ])
    mockGetMobileDiscussionBookChat.mockResolvedValue({
      id: bookChatId,
      name: '미움받을 용기',
      roomId,
      status: 'archived',
      thumbnailUrl: null,
      title: '미움받을 용기',
    })

    render(<MobileBookDiscussionScreen bookChatId={bookChatId} onBack={jest.fn()} roomId={roomId} />, {
      wrapper: createQueryWrapper(),
    })

    fireEvent.press(await screen.findByRole('button', { name: '별점' }))
    expect(await screen.findByText('민지')).toBeVisible()
    expect(screen.getByText('평균 4')).toBeVisible()
    expect(screen.getByText('천천히 다시 읽고 싶어요.')).toBeVisible()
    expect(screen.queryByRole('button', { name: '별점 남기기' })).toBeNull()
  })

  it('shows a retryable error when the rating roster query fails', async () => {
    mockGetMobileBookChatRatings.mockRejectedValueOnce(new Error('network unavailable')).mockResolvedValueOnce([])

    render(<MobileBookDiscussionScreen bookChatId={bookChatId} onBack={jest.fn()} roomId={roomId} />, {
      wrapper: createQueryWrapper(),
    })

    fireEvent.press(await screen.findByRole('button', { name: '별점' }))
    expect(
      await screen.findByRole('alert', { name: '별점을 불러오지 못했어요. 다시 시도해 주세요.' }),
    ).toBeVisible()

    fireEvent.press(screen.getByRole('button', { name: '별점 다시 시도' }))
    await waitFor(() => expect(mockGetMobileBookChatRatings).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('아직 별점을 남긴 멤버가 없어요.')).toBeVisible()
  })

  it('offers edit and remove for the current member and keeps the roster open when removal fails', async () => {
    mockGetMobileBookChatRatings.mockResolvedValue([
      {
        avatarPath: null,
        displayName: '나',
        isMe: true,
        profileId: firstMemberId,
        rating: 5,
        review: '끝까지 좋았어요.',
        updatedAt: '2026-08-18T01:00:00.000+00:00',
      },
    ])
    mockRemoveMobileBookChatRating.mockRejectedValue(new Error('network unavailable'))

    render(<MobileBookDiscussionScreen bookChatId={bookChatId} onBack={jest.fn()} roomId={roomId} />, {
      wrapper: createQueryWrapper(),
    })

    await waitFor(() => expect(mockGetMobileBookChatRatings).toHaveBeenCalledTimes(1))
    fireEvent.press(await screen.findByRole('button', { name: '별점' }))
    expect(await screen.findByRole('button', { name: '수정하기' })).toBeVisible()
    fireEvent.press(await screen.findByRole('button', { name: '별점 삭제' }))

    expect(
      await screen.findByRole('alert', { name: '별점을 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.' }),
    ).toBeVisible()
    expect(screen.getByText('끝까지 좋았어요.')).toBeVisible()
  })
})
