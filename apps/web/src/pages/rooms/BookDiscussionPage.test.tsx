import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BookDiscussionPage } from './BookDiscussionPage'

const {
  createPost,
  createReply,
  createManagedRoomInvite,
  getRoomManagement,
  getManagedBookChat,
  getBookChatRatings,
  getReadingRoom,
  getPosts,
  getVideoFilterMembers,
  getVideoPlaybackAuthorization,
  getVideoPosts,
  getVideoThumbnailAuthorizations,
  parsePostForm,
  requestManagedRoomInvite,
  removeBookChatRating,
  upsertBookChatRating,
  videoUploadState,
} = vi.hoisted(() => ({
  createPost: vi.fn().mockResolvedValue('post-1'),
  createReply: vi.fn().mockResolvedValue('reply-1'),
  createManagedRoomInvite: vi.fn().mockResolvedValue({
    code: 'TALK87',
    expiresAt: '2026-07-24T02:01:30.123+00:00',
    id: '00000000-0000-0000-0000-000000000011',
    token: 'a'.repeat(64),
  }),
  getManagedBookChat: vi.fn().mockResolvedValue({
    id: 'book-1',
    name: '미움받을 용기',
    roomId: 'room-1',
    status: 'reading',
    thumbnailUrl: null,
    title: '미움받을 용기',
  }),
  getRoomManagement: vi.fn().mockResolvedValue({
    canCurrentUserManageContent: true,
    createdBy: '00000000-0000-0000-0000-000000000001',
    currentUserRole: 'owner',
    description: null,
    id: 'room-1',
    isCurrentUserOwner: true,
    members: [],
    name: '금요일 아침 책방',
    status: 'active',
  }),
  getBookChatRatings: vi.fn().mockResolvedValue([]),
  getPosts: vi.fn().mockResolvedValue([]),
  getReadingRoom: vi.fn().mockResolvedValue({
    description: null,
    id: 'room-1',
    name: '금요일 아침 책방',
  }),
  getVideoFilterMembers: vi.fn().mockResolvedValue([
    {
      displayName: '민수',
      id: 'b3c8b282-6092-45f8-b15f-523a9dcd0eab',
      isCurrentUser: false,
    },
    {
      displayName: '나',
      id: '0ce71cea-b4ea-4e18-a605-bf2088d4ba15',
      isCurrentUser: true,
    },
  ]),
  getVideoPlaybackAuthorization: vi.fn().mockResolvedValue({
    expiresAt: 1_784_269_999,
    playbackId: 'playback-id',
    thumbnailToken: 'thumbnail-token',
    token: 'playback-token',
  }),
  getVideoPosts: vi.fn().mockResolvedValue([]),
  getVideoThumbnailAuthorizations: vi.fn().mockResolvedValue([]),
  parsePostForm: vi.fn(
    ({
      body,
      labels,
      mentionedMemberIds = [],
    }: {
      body: string
      labels: Array<{ kind: string; value: string }>
      mentionedMemberIds?: string[]
    }) => {
      const normalizedLabels = labels
        .map((label) => ({ ...label, value: label.value.trim() }))
        .filter((label) => label.value.length > 0)
      if (body.trim().length === 0 && normalizedLabels.length === 0) throw new Error('invalid post')
      return { body, labels: normalizedLabels, mentionedMemberIds }
    },
  ),
  requestManagedRoomInvite: vi.fn().mockResolvedValue(true),
  removeBookChatRating: vi.fn().mockResolvedValue(undefined),
  upsertBookChatRating: vi.fn().mockResolvedValue(undefined),
  videoUploadState: { isUploadingVideo: false },
}))

vi.mock('../../entities/post', () => ({
  createPost,
  createReply,
  getPosts,
  parsePostForm,
  postKeys: { byBookChat: (bookChatId: string) => ['posts', bookChatId] },
  shouldSubmitMessage: () => false,
}))

vi.mock('../../entities/book-chat', () => ({
  bookChatKeys: {
    detail: (bookChatId: string) => ['book-chat', bookChatId],
    room: (roomId: string) => ['reading-room', roomId],
  },
  getManagedBookChat,
  getReadingRoom,
}))

vi.mock('../../entities/video', () => ({
  createMuxThumbnailUrl: () => 'https://image.mux.com/playback-id/thumbnail.webp?token=token',
  getVideoFilterMembers,
  getVideoPlaybackAuthorization,
  getVideoPosts,
  getVideoThumbnailAuthorizations,
  mapVideoThumbnailAuthorizations: (authorizations: Array<{ postId: string }>) =>
    new Map(authorizations.map((authorization) => [authorization.postId, authorization])),
  videoKeys: {
    byBookChat: (bookChatId: string) => ['video-posts', bookChatId],
    members: (roomId: string) => ['video-filter-members', roomId],
    playback: (postId: string) => ['video-playback', postId],
    thumbnails: (postIds: string[]) => ['video-thumbnails', postIds],
  },
}))

vi.mock('../../features/photo-quote', async () => {
  const { insertQuoteIntoDraft } = await import('@talkhugam/domain')
  return {
    insertQuoteIntoDraft,
    PhotoQuoteFlow: ({
      file,
      onInsert,
    }: {
      file: File
      onInsert: (value: { page: string | null; quote: string }) => void
    }) => (
      <div aria-label="문장 고르기" role="dialog">
        <p>{file.name}</p>
        <button
          onClick={() => onInsert({ page: '87', quote: '우리는 늘 떠나는 쪽이었다' })}
          type="button"
        >
          가짜 글에 넣기
        </button>
      </div>
    ),
  }
})

vi.mock('../../shared/ui/LazyMuxVideoPlayer', () => ({
  LazyMuxVideoPlayer: ({ playbackId }: { playbackId: string }) => (
    <div data-playback-id={playbackId} data-testid="inline-mux-player" />
  ),
}))

vi.mock('../../entities/reading-room', () => ({
  readingRoomKeys: { all: ['reading-rooms'] },
}))

vi.mock('../../entities/room-management', () => ({
  createManagedRoomInvite,
  getRoomManagement,
  requestManagedRoomInvite,
  roomManagementKeys: { detail: (roomId: string) => ['room-management', roomId] },
}))

vi.mock('../../entities/book-rating', () => ({
  bookRatingKeys: {
    byChat: (bookChatId: string) => ['book-ratings', bookChatId],
    myBooks: (profileId: string) => ['my-rated-books', profileId],
  },
  calculateAverageRating: (ratings: Array<{ rating: number }>) =>
    ratings.length === 0
      ? null
      : Math.round((ratings.reduce((sum, item) => sum + item.rating, 0) / ratings.length) * 10) /
        10,
  getBookChatRatings,
  removeBookChatRating,
  upsertBookChatRating,
}))

vi.mock('../../features/auth', () => ({
  useAuthenticatedUser: () => ({ id: '00000000-0000-0000-0000-000000000001' }),
}))

vi.mock('../../features/video-upload', () => ({
  useVideoUpload: () => ({
    errorMessage: null,
    isUploadingVideo: videoUploadState.isUploadingVideo,
    uploadVideo: vi.fn(),
  }),
}))

vi.mock('../../shared/api/supabaseClient', () => ({
  createSupabaseClient: vi.fn(),
}))

describe('BookDiscussionPage', () => {
  afterEach(() => {
    cleanup()
    createPost.mockClear()
    createReply.mockClear()
    getPosts.mockClear()
    getPosts.mockResolvedValue([])
    getVideoThumbnailAuthorizations.mockClear()
    getVideoThumbnailAuthorizations.mockResolvedValue([])
    getVideoPlaybackAuthorization.mockClear()
    getVideoPlaybackAuthorization.mockResolvedValue({
      expiresAt: 1_784_269_999,
      playbackId: 'playback-id',
      thumbnailToken: 'thumbnail-token',
      token: 'playback-token',
    })
    getVideoFilterMembers.mockClear()
    getVideoPosts.mockClear()
    getVideoPosts.mockResolvedValue([])
    requestManagedRoomInvite.mockClear()
    requestManagedRoomInvite.mockResolvedValue(true)
    getBookChatRatings.mockReset()
    getBookChatRatings.mockResolvedValue([])
    removeBookChatRating.mockClear()
    removeBookChatRating.mockResolvedValue(undefined)
    upsertBookChatRating.mockClear()
    upsertBookChatRating.mockResolvedValue(undefined)
    videoUploadState.isUploadingVideo = false
  })

  it('scopes book chat and text post queries to the route room', async () => {
    renderBookDiscussionPage()

    await vi.waitFor(() => {
      expect(getManagedBookChat).toHaveBeenCalledWith(undefined, 'room-1', 'book-1')
      expect(getPosts).toHaveBeenCalledWith(undefined, 'room-1', 'book-1')
    })
  })

  it('keeps a text message within seventy percent of the chat timeline width', async () => {
    getPosts.mockResolvedValueOnce([
      {
        authorName: '서연',
        body: '이 문장이 특히 좋았어요.',
        createdAt: '2026-07-18T00:00:00.000Z',
        depth: 0,
        id: 'post-1',
        labels: [],
        rootPostId: null,
      },
    ])
    renderBookDiscussionPage()

    const message = await screen.findByText('이 문장이 특히 좋았어요.')

    expect(message.closest('article')).toHaveClass('max-w-[70%]')
    expect(message.closest('article')).toHaveClass('w-fit')
  })

  it('aligns my text, reply, and video messages to the right', async () => {
    getPosts.mockResolvedValueOnce([
      {
        authorMemberId: '0ce71cea-b4ea-4e18-a605-bf2088d4ba15',
        authorName: '나',
        body: '내 독후감',
        createdAt: '2026-07-18T00:00:00.000Z',
        depth: 0,
        id: 'post-1',
        labels: [],
        rootPostId: null,
      },
      {
        authorMemberId: '0ce71cea-b4ea-4e18-a605-bf2088d4ba15',
        authorName: '나',
        body: '내 답글',
        createdAt: '2026-07-18T00:01:00.000Z',
        depth: 1,
        id: 'reply-1',
        labels: [],
        rootPostId: 'post-1',
      },
      {
        authorMemberId: 'b3c8b282-6092-45f8-b15f-523a9dcd0eab',
        authorName: '민수',
        body: '다른 멤버의 독후감',
        createdAt: '2026-07-18T00:02:00.000Z',
        depth: 0,
        id: 'post-2',
        labels: [],
        rootPostId: null,
      },
    ])
    getVideoPosts.mockResolvedValueOnce([
      {
        authorMemberId: '0ce71cea-b4ea-4e18-a605-bf2088d4ba15',
        authorName: '나',
        body: null,
        createdAt: '2026-07-18T00:03:00.000Z',
        id: 'video-1',
        status: 'failed',
      },
    ])
    renderBookDiscussionPage()

    expect((await screen.findByText('내 독후감')).closest('li')).toHaveClass('justify-end')
    expect(screen.getByText('내 답글').closest('li')).toHaveClass('justify-end')
    expect(screen.getByText('다른 멤버의 독후감').closest('li')).toHaveClass('justify-start')
    await openVideoTab()
    expect(
      screen.getByText('영상을 처리하지 못했어요. 지우고 다시 올려 주세요.').closest('li'),
    ).toHaveClass('justify-end')
    expect(screen.getByRole('button', { name: '영상 기록에서 정리하기' })).toBeInTheDocument()
  })

  it('keeps the chat input at sixteen pixels to prevent mobile Safari zoom', () => {
    renderBookDiscussionPage()

    expect(screen.getByLabelText('메시지 입력')).toHaveClass('text-base')
  })

  it('highlights at-sign mentions in discussion posts and replies', async () => {
    getPosts.mockResolvedValueOnce([
      {
        authorName: '민수',
        body: '@수진 이 장면은 오래 남네요.',
        createdAt: '2026-07-19T00:00:00.000Z',
        depth: 0,
        id: 'post-1',
        labels: [],
        rootPostId: null,
      },
      {
        authorName: '수진',
        body: '@민수 저도 같은 부분이 좋았어요.',
        createdAt: '2026-07-19T00:01:00.000Z',
        depth: 1,
        id: 'reply-1',
        labels: [],
        rootPostId: 'post-1',
      },
    ])
    renderBookDiscussionPage()

    expect(await screen.findByText('@수진')).toHaveClass('text-primary')
    expect(screen.getByText('@민수')).toHaveClass('text-primary')
  })

  it('opens the bookshop invitation sheet from the plus menu without clearing a draft', async () => {
    renderBookDiscussionPage()
    const messageInput = screen.getByLabelText('메시지 입력')
    fireEvent.change(messageInput, { target: { value: '이 문장을 나누고 싶어요.' } })
    fireEvent.click(screen.getByRole('button', { name: '메시지 추가 메뉴 열기' }))
    fireEvent.click(await screen.findByRole('button', { name: '책방 초대하기' }))

    expect(await screen.findByRole('dialog', { name: '책방 초대하기' })).toBeInTheDocument()
    expect(messageInput).toHaveValue('이 문장을 나누고 싶어요.')
  })

  it('lets a manager create an invite instead of requesting one', async () => {
    getRoomManagement.mockResolvedValueOnce({
      canCurrentUserManageContent: true,
      createdBy: '00000000-0000-0000-0000-000000000001',
      currentUserRole: 'manager',
      description: null,
      id: 'room-1',
      isCurrentUserOwner: false,
      members: [],
      name: '금요일 아침 책방',
      status: 'active',
    })
    renderBookDiscussionPage()

    fireEvent.click(screen.getByRole('button', { name: '메시지 추가 메뉴 열기' }))

    expect(await screen.findByRole('button', { name: '책방 초대하기' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '초대 요청' })).not.toBeInTheDocument()
  })

  it('lets a non-owner request an invite from the room owner', async () => {
    getRoomManagement.mockResolvedValueOnce({
      canCurrentUserManageContent: false,
      createdBy: '00000000-0000-0000-0000-000000000001',
      currentUserRole: 'member',
      description: null,
      id: 'room-1',
      isCurrentUserOwner: false,
      members: [],
      name: '금요일 아침 책방',
      status: 'active',
    })
    renderBookDiscussionPage()

    fireEvent.click(screen.getByRole('button', { name: '메시지 추가 메뉴 열기' }))

    fireEvent.click(await screen.findByRole('button', { name: '초대 요청' }))

    await vi.waitFor(() =>
      expect(requestManagedRoomInvite).toHaveBeenCalledWith(undefined, 'room-1'),
    )
    expect(await screen.findByText('방장에게 책방 초대를 요청했어요.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '책방 초대하기' })).not.toBeInTheDocument()
  })

  it('shows the bookshop in the header and the selected book as the discussion title', async () => {
    renderBookDiscussionPage()

    expect(await screen.findByText('금요일 아침 책방')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '미움받을 용기' })).toBeInTheDocument()
  })

  it('plays a full-width ratio video inline from the bookmark video tab', async () => {
    getVideoPosts.mockResolvedValueOnce([
      {
        authorName: '민규',
        body: null,
        createdAt: '2026-07-18T00:00:00.000Z',
        id: 'video-1',
        status: 'ready',
      },
    ])
    getVideoThumbnailAuthorizations.mockResolvedValueOnce([
      {
        postId: 'video-1',
        playbackId: 'playback-id',
        thumbnailToken: 'thumbnail-token',
      },
    ])
    renderBookDiscussionPage()

    expect(await screen.findByRole('tab', { name: '책갈피' })).toBeInTheDocument()
    await openVideoTab()
    const preview = await screen.findByRole('button', { name: '민규님의 영상 보기' })
    expect(preview).toHaveClass('w-full')
    expect(preview).toHaveClass('aspect-video')
    expect(preview.querySelector('img')).toBeInTheDocument()
    expect(getVideoThumbnailAuthorizations).toHaveBeenCalledWith(undefined, ['video-1'])

    fireEvent.click(preview)

    expect(await screen.findByTestId('inline-mux-player')).toHaveAttribute(
      'data-playback-id',
      'playback-id',
    )
    expect(getVideoPlaybackAuthorization).toHaveBeenCalledWith(undefined, 'video-1')
    expect(screen.queryByText('몰입형 영상 화면')).not.toBeInTheDocument()
  })

  it('opens the message actions in a SEED action sheet', () => {
    renderBookDiscussionPage()

    fireEvent.click(screen.getByRole('button', { name: '메시지 추가 메뉴 열기' }))

    expect(screen.getByRole('dialog', { name: '메시지 추가' })).toHaveClass(
      'seed-menu-sheet__content',
    )
    expect(screen.getByRole('button', { name: '영상 올리기' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '페이지 라벨' })).toHaveClass(
      'talkhugam-action-sheet-choice',
    )
  })

  it('inserts a quote picked from a page photo with its page label', async () => {
    renderBookDiscussionPage()

    fireEvent.click(screen.getByRole('button', { name: '메시지 추가 메뉴 열기' }))
    fireEvent.click(screen.getByRole('button', { name: '사진에서 문장 가져오기' }))
    fireEvent.change(screen.getByLabelText('문장을 가져올 사진 선택'), {
      target: { files: [new File(['jpeg'], 'page-87.jpg', { type: 'image/jpeg' })] },
    })

    expect(await screen.findByRole('dialog', { name: '문장 고르기' })).toHaveTextContent(
      'page-87.jpg',
    )
    fireEvent.click(screen.getByRole('button', { name: '가짜 글에 넣기' }))

    expect(screen.queryByRole('dialog', { name: '문장 고르기' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('메시지 입력')).toHaveValue('「우리는 늘 떠나는 쪽이었다」\n')
    expect(
      within(screen.getByRole('list', { name: '선택한 라벨' })).getByText('페이지 87'),
    ).toBeInTheDocument()
  })

  it('keeps every chat action in the same two-column grid', () => {
    renderBookDiscussionPage()

    fireEvent.click(screen.getByRole('button', { name: '메시지 추가 메뉴 열기' }))

    expect(screen.getByRole('button', { name: '별점' })).not.toHaveClass('col-span-2')
  })

  it('aligns the add button, message input, and send button in one composer grid', () => {
    renderBookDiscussionPage()

    const input = screen.getByLabelText('메시지 입력')

    expect(input.closest('.talkhugam-chat-composer-row')).toBeInTheDocument()
  })

  it('opens the rating form from the plus menu before it saves my rating', async () => {
    renderBookDiscussionPage()

    expect(screen.queryByRole('button', { name: '별점 남기기' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '메시지 추가 메뉴 열기' }))
    fireEvent.click(screen.getByRole('button', { name: '별점' }))

    expect(await screen.findByRole('dialog', { name: '별점' })).toBeInTheDocument()

    expect(upsertBookChatRating).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByRole('button', { name: '별점 남기기' }))
    fireEvent.click(screen.getByRole('button', { name: '5점' }))
    fireEvent.change(screen.getByLabelText('총평 (선택)'), {
      target: { value: '대화가 오래 남는 책이에요.' },
    })
    fireEvent.click(screen.getByRole('button', { name: '별점 저장' }))

    await vi.waitFor(() =>
      expect(upsertBookChatRating).toHaveBeenCalledWith(undefined, {
        bookChatId: 'book-1',
        rating: 5,
        review: '대화가 오래 남는 책이에요.',
      }),
    )
  })

  it('shows the average rating and each member rating in the rating sheet', async () => {
    getBookChatRatings.mockResolvedValue([
      createRating({ displayName: '민수', isMe: false, rating: 4, review: '천천히 읽었어요.' }),
      createRating({ displayName: '민규', isMe: true, rating: 5, review: null }),
    ])
    renderBookDiscussionPage()

    fireEvent.click(screen.getByRole('button', { name: '메시지 추가 메뉴 열기' }))
    fireEvent.click(screen.getByRole('button', { name: '별점' }))

    expect(await screen.findByText('평균 4.5')).toBeInTheDocument()
    const memberList = screen.getByRole('list', { name: '멤버 별점' })
    expect(within(memberList).getByText('민수')).toBeInTheDocument()
    expect(within(memberList).getByRole('img', { name: '별점 4점' })).toBeInTheDocument()
    expect(within(memberList).getByText('천천히 읽었어요.')).toBeInTheDocument()
    expect(within(memberList).getByText('나')).toBeInTheDocument()
    expect(within(memberList).getByRole('img', { name: '별점 5점' })).toBeInTheDocument()
  })

  it('updates the rating sheet immediately after saving my rating', async () => {
    const refresh = createDeferredValue<ReturnType<typeof createRating>[]>()
    getBookChatRatings.mockResolvedValueOnce([]).mockReturnValueOnce(refresh.promise)
    renderBookDiscussionPage()

    fireEvent.click(screen.getByRole('button', { name: '메시지 추가 메뉴 열기' }))
    fireEvent.click(screen.getByRole('button', { name: '별점' }))
    fireEvent.click(await screen.findByRole('button', { name: '별점 남기기' }))
    fireEvent.click(screen.getByRole('button', { name: '3점' }))
    fireEvent.click(screen.getByRole('button', { name: '별점 저장' }))

    expect(await screen.findByText('평균 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '별점 수정' })).toBeInTheDocument()

    refresh.resolve([])
  })

  it('refreshes rating views after saving my rating', async () => {
    const { queryClient } = renderBookDiscussionPage()
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')

    fireEvent.click(screen.getByRole('button', { name: '메시지 추가 메뉴 열기' }))
    fireEvent.click(screen.getByRole('button', { name: '별점' }))
    fireEvent.click(await screen.findByRole('button', { name: '별점 남기기' }))
    fireEvent.click(screen.getByRole('button', { name: '4점' }))
    fireEvent.click(screen.getByRole('button', { name: '별점 저장' }))

    await vi.waitFor(() =>
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['book-ratings', 'book-1'],
        refetchType: 'inactive',
      }),
    )
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['my-rated-books', '00000000-0000-0000-0000-000000000001'],
    })
  })

  it('reopens my saved rating for editing and removes it', async () => {
    getBookChatRatings.mockResolvedValue([
      createRating({ isMe: true, rating: 4, review: '다시 펼쳐 보고 싶은 책이에요.' }),
    ])
    renderBookDiscussionPage()

    fireEvent.click(screen.getByRole('button', { name: '메시지 추가 메뉴 열기' }))
    fireEvent.click(screen.getByRole('button', { name: '별점' }))
    fireEvent.click(await screen.findByRole('button', { name: '별점 수정' }))

    expect(screen.getByRole('button', { name: '4점' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('총평 (선택)')).toHaveValue('다시 펼쳐 보고 싶은 책이에요.')
    fireEvent.click(screen.getByRole('button', { name: '취소' }))
    fireEvent.click(screen.getByRole('button', { name: '별점 삭제' }))

    await vi.waitFor(() => expect(removeBookChatRating).toHaveBeenCalledWith(undefined, 'book-1'))
  })

  it('shows a loading state without rating actions while ratings are loading', async () => {
    getBookChatRatings.mockReturnValue(new Promise(() => undefined))
    renderBookDiscussionPage()

    openRatingSheet()

    expect(
      await screen.findByRole('status', { name: '별점을 불러오고 있어요.' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '별점 남기기' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '별점 수정' })).not.toBeInTheDocument()
  })

  it('shows a retry state without rating actions when ratings fail to load', async () => {
    getBookChatRatings
      .mockRejectedValueOnce(new Error('ratings unavailable'))
      .mockResolvedValue([createRating({ isMe: true, rating: 4, review: null })])
    renderBookDiscussionPage()

    openRatingSheet()

    const sheet = await screen.findByRole('dialog', { name: '별점' })
    expect(await within(sheet).findByRole('alert')).toHaveTextContent(
      '별점을 불러오지 못했어요. 다시 시도해 주세요.',
    )
    expect(within(sheet).queryByRole('button', { name: '별점 남기기' })).not.toBeInTheDocument()
    expect(within(sheet).queryByRole('button', { name: '별점 삭제' })).not.toBeInTheDocument()
    fireEvent.click(within(sheet).getByRole('button', { name: '별점 다시 시도' }))

    expect(await within(sheet).findByRole('button', { name: '별점 수정' })).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: '별점 삭제' })).toBeInTheDocument()
  })

  it('tells me when removing my rating fails', async () => {
    getBookChatRatings.mockResolvedValue([createRating({ isMe: true, rating: 4, review: null })])
    removeBookChatRating.mockRejectedValueOnce(new Error('remove failed'))
    renderBookDiscussionPage()

    openRatingSheet()
    fireEvent.click(await screen.findByRole('button', { name: '별점 삭제' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '별점을 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.',
    )
  })

  it('shows ratings without save, edit, or remove actions in an archived book chat', async () => {
    getManagedBookChat.mockResolvedValueOnce({
      id: 'book-1',
      name: '미움받을 용기',
      roomId: 'room-1',
      status: 'archived',
      thumbnailUrl: null,
      title: '미움받을 용기',
    })
    getBookChatRatings.mockResolvedValue([createRating({ isMe: true, rating: 4, review: null })])
    renderBookDiscussionPage()

    expect(await screen.findByRole('heading', { name: '미움받을 용기' })).toBeInTheDocument()
    openRatingSheet()

    expect(await screen.findByText('평균 4')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '별점 수정' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '별점 남기기' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '별점 삭제' })).not.toBeInTheDocument()
  })

  it('shows matching members from an at-sign typed in the message input', async () => {
    renderBookDiscussionPage()
    fireEvent.change(screen.getByLabelText('메시지 입력'), { target: { value: '@민' } })

    expect(await screen.findByRole('listbox', { name: '멘션할 멤버' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '민수 멘션 추가' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '메시지 추가 메뉴 열기' }))
    expect(screen.queryByRole('button', { name: '멤버 멘션' })).not.toBeInTheDocument()
  })

  it.each([
    ['outside click', () => fireEvent.pointerDown(document.body)],
    ['Escape', () => fireEvent.keyDown(window, { key: 'Escape' })],
  ])('dismisses at-sign candidates with %s without clearing the draft', async (_, dismiss) => {
    renderBookDiscussionPage()
    fireEvent.change(screen.getByLabelText('메시지 입력'), { target: { value: '@민' } })
    await screen.findByRole('listbox', { name: '멘션할 멤버' })

    dismiss()

    expect(screen.queryByRole('listbox', { name: '멘션할 멤버' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('메시지 입력')).toHaveValue('@민')
  })

  it('preserves the draft, labels, and mentions after closing the SEED action sheet', async () => {
    renderBookDiscussionPage()
    await prepareComposerState()

    fireEvent.click(screen.getByRole('button', { name: '메시지 추가 메뉴 열기' }))
    fireEvent.click(screen.getByRole('button', { name: '메시지 추가 닫기' }))

    expectComposerState()
  })

  it('does not offer the current user as an at-sign mention candidate', async () => {
    renderBookDiscussionPage()
    fireEvent.change(screen.getByLabelText('메시지 입력'), { target: { value: '@' } })

    expect(await screen.findByRole('option', { name: '민수 멘션 추가' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: '나 멘션 추가' })).not.toBeInTheDocument()
  })

  it('shows a retry action when loading mention members fails', async () => {
    getVideoFilterMembers.mockRejectedValueOnce(new Error('network'))
    renderBookDiscussionPage()
    fireEvent.change(screen.getByLabelText('메시지 입력'), { target: { value: '@' } })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '멘션할 멤버를 불러오지 못했어요. 다시 시도해 주세요.',
    )
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    await vi.waitFor(() => expect(getVideoFilterMembers).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole('option', { name: '민수 멘션 추가' })).toBeInTheDocument()
  })

  it('shows the normal empty state without an error or retry action', async () => {
    getVideoFilterMembers.mockResolvedValueOnce([])
    renderBookDiscussionPage()
    fireEvent.change(screen.getByLabelText('메시지 입력'), { target: { value: '@' } })

    expect(await screen.findByText('멘션할 멤버가 없어요.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument()
  })

  it('shows a post query error instead of the empty conversation state and retries', async () => {
    getPosts.mockRejectedValueOnce(new Error('network'))
    renderBookDiscussionPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '독후감을 불러오지 못했어요. 다시 시도해 주세요.',
    )
    expect(screen.queryByText('첫 독후감을 남겨 보세요')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    await vi.waitFor(() => expect(getPosts).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('첫 독후감을 남겨 보세요')).toBeInTheDocument()
  })

  it('shows a video query error instead of the empty conversation state and retries', async () => {
    getVideoPosts.mockRejectedValueOnce(new Error('network'))
    renderBookDiscussionPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '영상을 불러오지 못했어요. 다시 시도해 주세요.',
    )
    expect(screen.queryByText('첫 독후감을 남겨 보세요')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    await vi.waitFor(() => expect(getVideoPosts).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('첫 독후감을 남겨 보세요')).toBeInTheDocument()
  })

  it('keeps loaded posts visible when the video query fails', async () => {
    getPosts.mockResolvedValueOnce([
      {
        authorName: '서연',
        body: '이 문장이 특히 좋았어요.',
        createdAt: '2026-07-18T00:00:00.000Z',
        depth: 0,
        id: 'f17c0d6d-3e6e-4b7f-a1f1-5d652aa2a85e',
        labels: [],
        rootPostId: null,
      },
    ])
    getVideoPosts.mockRejectedValueOnce(new Error('network'))
    renderBookDiscussionPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '영상을 불러오지 못했어요. 다시 시도해 주세요.',
    )
    expect(screen.getByText('이 문장이 특히 좋았어요.')).toBeInTheDocument()
  })

  it('keeps loaded videos visible when the post query fails', async () => {
    getPosts.mockRejectedValueOnce(new Error('network'))
    getVideoPosts.mockResolvedValueOnce([
      {
        authorName: '민규',
        body: null,
        createdAt: '2026-07-17T00:00:00.000Z',
        id: 'video-1',
        status: 'processing',
      },
    ])
    renderBookDiscussionPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '독후감을 불러오지 못했어요. 다시 시도해 주세요.',
    )
    await openVideoTab()
    expect(screen.getByRole('status', { name: '영상 준비 중…' })).toBeInTheDocument()
  })

  it('shows a post query error while the video query is still loading', async () => {
    const videoRequest = createDeferredValue<never[]>()
    getPosts.mockRejectedValueOnce(new Error('network'))
    getVideoPosts.mockReturnValueOnce(videoRequest.promise)
    renderBookDiscussionPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '독후감을 불러오지 못했어요. 다시 시도해 주세요.',
    )

    videoRequest.resolve([])
  })

  it('shows the book loader and disables retry while a failed query is retrying', async () => {
    const retryRequest = createDeferredValue<never[]>()
    getPosts.mockRejectedValueOnce(new Error('network'))
    getPosts.mockReturnValueOnce(retryRequest.promise)
    renderBookDiscussionPage()

    const retryButton = await screen.findByRole('button', { name: '다시 시도' })
    fireEvent.click(retryButton)

    expect(
      await screen.findByRole('status', { name: '대화를 다시 불러오고 있어요.' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeDisabled()

    retryRequest.resolve([])
    expect(await screen.findByText('첫 독후감을 남겨 보세요')).toBeInTheDocument()
  })

  it('gives an at-sign mention candidate a 44px touch target', async () => {
    renderBookDiscussionPage()
    fireEvent.change(screen.getByLabelText('메시지 입력'), { target: { value: '@' } })

    expect(await screen.findByRole('option', { name: '민수 멘션 추가' })).toHaveClass('min-h-11')
  })

  it('submits selected mentions with a new post', async () => {
    renderBookDiscussionPage()
    await insertMention('함께 읽어 봐요')
    fireEvent.click(screen.getByRole('button', { name: '전송' }))

    await vi.waitFor(() =>
      expect(createPost).toHaveBeenCalledWith(
        undefined,
        'book-1',
        expect.objectContaining({
          mentionedMemberIds: ['b3c8b282-6092-45f8-b15f-523a9dcd0eab'],
        }),
      ),
    )
  })

  it('submits selected mentions with a reply', async () => {
    getPosts.mockResolvedValueOnce([
      {
        authorName: '서연',
        body: '인상 깊었어요',
        createdAt: '2026-07-18T00:00:00.000Z',
        depth: 0,
        id: 'f17c0d6d-3e6e-4b7f-a1f1-5d652aa2a85e',
        labels: [],
        rootPostId: null,
      },
    ])
    renderBookDiscussionPage()

    fireEvent.click(await screen.findByRole('button', { name: '답글 남기기' }))
    await insertMention('저도요')
    fireEvent.click(screen.getByRole('button', { name: '전송' }))

    await vi.waitFor(() =>
      expect(createReply).toHaveBeenCalledWith(
        undefined,
        'f17c0d6d-3e6e-4b7f-a1f1-5d652aa2a85e',
        expect.objectContaining({
          mentionedMemberIds: ['b3c8b282-6092-45f8-b15f-523a9dcd0eab'],
        }),
      ),
    )
  })

  it('clears the new post draft, labels, and mentions after a successful submission', async () => {
    renderBookDiscussionPage()
    await prepareComposerState()

    fireEvent.click(screen.getByRole('button', { name: '전송' }))

    await vi.waitFor(() => {
      expect(createPost).toHaveBeenCalledTimes(1)
      expect(screen.getByLabelText('메시지 입력')).toHaveValue('')
      expect(screen.queryByText('페이지 87')).not.toBeInTheDocument()
      expect(screen.queryByRole('listbox', { name: '멘션할 멤버' })).not.toBeInTheDocument()
    })
  })

  it('clears the reply state after a successful reply submission', async () => {
    getPosts.mockResolvedValueOnce([
      {
        authorName: '서연',
        body: '인상 깊었어요',
        createdAt: '2026-07-18T00:00:00.000Z',
        depth: 0,
        id: 'f17c0d6d-3e6e-4b7f-a1f1-5d652aa2a85e',
        labels: [],
        rootPostId: null,
      },
    ])
    renderBookDiscussionPage()
    fireEvent.click(await screen.findByRole('button', { name: '답글 남기기' }))
    await insertMention('저도요')

    fireEvent.click(screen.getByRole('button', { name: '전송' }))

    await vi.waitFor(() => {
      expect(createReply).toHaveBeenCalledTimes(1)
      expect(screen.queryByText('답글 남기기', { selector: 'p' })).not.toBeInTheDocument()
      expect(screen.getByLabelText('메시지 입력')).toHaveValue('')
      expect(screen.queryByRole('listbox', { name: '멘션할 멤버' })).not.toBeInTheDocument()
    })
  })

  it('preserves the draft, labels, and mentions when a post submission fails', async () => {
    createPost.mockRejectedValueOnce(new Error('network'))
    renderBookDiscussionPage()
    await prepareComposerState()

    fireEvent.click(screen.getByRole('button', { name: '전송' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '독후감을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.',
    )
    expectComposerState()
  })

  it('preserves the reply state, draft, and mentions when a reply submission fails', async () => {
    getPosts.mockResolvedValueOnce([
      {
        authorName: '서연',
        body: '인상 깊었어요',
        createdAt: '2026-07-18T00:00:00.000Z',
        depth: 0,
        id: 'f17c0d6d-3e6e-4b7f-a1f1-5d652aa2a85e',
        labels: [],
        rootPostId: null,
      },
    ])
    createReply.mockRejectedValueOnce(new Error('network'))
    renderBookDiscussionPage()
    fireEvent.click(await screen.findByRole('button', { name: '답글 남기기' }))
    await insertMention('저도요')

    fireEvent.click(screen.getByRole('button', { name: '전송' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '독후감을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.',
    )
    expect(screen.getByText('답글 남기기', { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByLabelText('메시지 입력')).toHaveValue('@민수 저도요')
  })

  it('returns to label selection and keeps only the message draft after closing the SEED sheet', () => {
    renderBookDiscussionPage()
    openPageLabelEditor()
    fireEvent.change(screen.getByLabelText('페이지 번호'), { target: { value: '87' } })
    fireEvent.change(screen.getByLabelText('메시지 입력'), {
      target: { value: '이 문장을 기억할게요' },
    })

    fireEvent.click(screen.getByRole('button', { name: '페이지 라벨 닫기' }))
    fireEvent.click(screen.getByRole('button', { name: '메시지 추가 메뉴 열기' }))

    expect(screen.getByRole('button', { name: '페이지 라벨' })).toBeInTheDocument()
    expect(screen.queryByLabelText('페이지 번호')).not.toBeInTheDocument()
    expect(screen.getByLabelText('메시지 입력')).toHaveValue('이 문장을 기억할게요')

    fireEvent.click(screen.getByRole('button', { name: '페이지 라벨' }))
    expect(screen.getByLabelText('페이지 번호')).toHaveValue('')
  })

  it('keeps separate label drafts while returning inside the still-open action menu', () => {
    renderBookDiscussionPage()
    openPageLabelEditor()
    fireEvent.change(screen.getByLabelText('페이지 번호'), { target: { value: '87' } })
    fireEvent.click(screen.getByRole('button', { name: '라벨 종류 선택으로 돌아가기' }))
    fireEvent.click(screen.getByRole('button', { name: '챕터 라벨' }))
    fireEvent.change(screen.getByLabelText('챕터 이름 또는 번호'), {
      target: { value: '3장 고독' },
    })

    fireEvent.click(screen.getByRole('button', { name: '라벨 종류 선택으로 돌아가기' }))
    fireEvent.click(screen.getByRole('button', { name: '페이지 라벨' }))
    expect(screen.getByLabelText('페이지 번호')).toHaveValue('87')

    fireEvent.click(screen.getByRole('button', { name: '라벨 종류 선택으로 돌아가기' }))
    fireEvent.click(screen.getByRole('button', { name: '챕터 라벨' }))
    expect(screen.getByLabelText('챕터 이름 또는 번호')).toHaveValue('3장 고독')
  })

  it('moves focus to the first label action when returning to label selection', async () => {
    renderBookDiscussionPage()
    openPageLabelEditor()

    fireEvent.click(screen.getByRole('button', { name: '라벨 종류 선택으로 돌아가기' }))

    await vi.waitFor(() =>
      expect(screen.getByRole('button', { name: '페이지 라벨' })).toHaveFocus(),
    )
  })

  it('clears only the submitted label draft, closes the menu, and focuses the message input', async () => {
    renderBookDiscussionPage()
    openPageLabelEditor()
    fireEvent.change(screen.getByLabelText('페이지 번호'), { target: { value: '87' } })

    fireEvent.click(screen.getByRole('button', { name: '라벨 추가' }))

    expect(screen.getByText('페이지 87')).toBeInTheDocument()
    expect(screen.queryByLabelText('페이지 번호')).not.toBeInTheDocument()
    await vi.waitFor(() => expect(screen.getByLabelText('메시지 입력')).toHaveFocus())

    fireEvent.click(screen.getByRole('button', { name: '메시지 추가 메뉴 열기' }))
    fireEvent.click(screen.getByRole('button', { name: '페이지 라벨' }))
    expect(screen.getByLabelText('페이지 번호')).toHaveValue('')
  })

  it('adds a label when Enter is pressed in the label input', async () => {
    renderBookDiscussionPage()
    openPageLabelEditor()
    fireEvent.change(screen.getByLabelText('페이지 번호'), { target: { value: '87' } })

    fireEvent.keyDown(screen.getByLabelText('페이지 번호'), { key: 'Enter' })

    expect(screen.getByText('페이지 87')).toBeInTheDocument()
    await vi.waitFor(() => expect(screen.getByLabelText('메시지 입력')).toHaveFocus())
  })

  it('keeps an invalid label draft open so the user can correct it', () => {
    renderBookDiscussionPage()
    openPageLabelEditor()
    fireEvent.change(screen.getByLabelText('페이지 번호'), { target: { value: '   ' } })

    fireEvent.click(screen.getByRole('button', { name: '라벨 추가' }))

    expect(screen.getByLabelText('페이지 번호')).toHaveValue('   ')
    expect(screen.getByRole('dialog', { name: '페이지 라벨' })).toBeInTheDocument()
  })

  it('uses the book loader while the selected video is uploading', () => {
    videoUploadState.isUploadingVideo = true
    renderBookDiscussionPage()

    const status = screen.getByRole('status', { name: '영상을 채팅에 올리고 있어요…' })
    expect(status.querySelector('.talkhugam-book-loader')).toBeInTheDocument()
  })

  it('uses the book loader while a video message is being prepared', async () => {
    getVideoPosts.mockResolvedValueOnce([
      {
        authorName: '민규',
        body: null,
        createdAt: '2026-07-17T00:00:00.000Z',
        id: 'video-1',
        status: 'processing',
      },
    ])
    renderBookDiscussionPage()

    await openVideoTab()
    const status = await screen.findByRole('status', { name: '영상 준비 중…' })
    expect(status.querySelector('.talkhugam-book-loader')).toBeInTheDocument()
  })
})

/** 책 대화 테스트에서 영상 탭을 열어 영상 메시지를 검증할 수 있게 한다. */
/** 메시지 추가 메뉴에서 별점 시트를 연다. */
function openRatingSheet() {
  fireEvent.click(screen.getByRole('button', { name: '메시지 추가 메뉴 열기' }))
  fireEvent.click(screen.getByRole('button', { name: '별점' }))
}

async function openVideoTab() {
  fireEvent.click(await screen.findByRole('tab', { name: '영상' }))
}

function openPageLabelEditor() {
  fireEvent.click(screen.getByRole('button', { name: '메시지 추가 메뉴 열기' }))
  fireEvent.click(screen.getByRole('button', { name: '페이지 라벨' }))
}

/** 본문·페이지 라벨·멤버 멘션을 포함한 작성 중 상태를 만든다. */
async function prepareComposerState() {
  openPageLabelEditor()
  fireEvent.change(screen.getByLabelText('페이지 번호'), { target: { value: '87' } })
  fireEvent.click(screen.getByRole('button', { name: '라벨 추가' }))
  await insertMention('함께 읽어 봐요')
}

/** 작성 중인 본문·라벨·멘션이 화면에 유지되는지 검증한다. */
function expectComposerState() {
  expect(screen.getByLabelText('메시지 입력')).toHaveValue('@민수 함께 읽어 봐요')
  expect(screen.getByText('페이지 87')).toBeInTheDocument()
  expect(screen.queryByText('선택한 멘션')).not.toBeInTheDocument()
}

/** 입력창의 @ 후보를 선택해 본문과 알림 대상에 멤버 멘션을 추가한다. */
async function insertMention(message: string) {
  fireEvent.change(screen.getByLabelText('메시지 입력'), { target: { value: '@민' } })
  fireEvent.click(await screen.findByRole('option', { name: '민수 멘션 추가' }))
  fireEvent.change(screen.getByLabelText('메시지 입력'), {
    target: { value: `@민수 ${message}` },
  })
}

function renderBookDiscussionPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const renderResult = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/rooms/room-1/books/book-1']}>
        <Routes>
          <Route path="/rooms/:roomId/books/:bookChatId" element={<BookDiscussionPage />} />
          <Route
            path="/rooms/:roomId/books/:bookChatId/videos/:videoId"
            element={<p>몰입형 영상 화면</p>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )

  return { queryClient, renderResult }
}

/** 테스트에서 임의 시점에 완료할 비동기 값을 만든다. */
function createDeferredValue<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })

  return { promise, resolve }
}

/** 별점 시트 테스트에서 쓰는 멤버 별점 응답을 생성한다. */
function createRating({
  displayName = '민규',
  isMe,
  rating,
  review,
}: {
  displayName?: string
  isMe: boolean
  rating: number
  review: string | null
}) {
  return {
    avatarPath: null,
    displayName,
    isMe,
    profileId: isMe
      ? '0ce71cea-b4ea-4e18-a605-bf2088d4ba15'
      : 'b3c8b282-6092-45f8-b15f-523a9dcd0eab',
    rating,
    review,
    updatedAt: '2026-07-19T00:00:00.000Z',
  }
}
