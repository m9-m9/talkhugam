import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BookDiscussionPage } from './BookDiscussionPage'

const {
  createPost,
  createReply,
  createManagedRoomInvite,
  getRoomManagement,
  getManagedBookChat,
  getBookChatCompletions,
  getReadingRoom,
  getPosts,
  getVideoFilterMembers,
  getVideoPosts,
  getVideoThumbnailAuthorizations,
  parsePostForm,
  upsertBookChatCompletion,
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
    createdBy: '00000000-0000-0000-0000-000000000001',
    description: null,
    id: 'room-1',
    isCurrentUserOwner: true,
    members: [],
    name: '금요일 아침 책방',
    status: 'active',
  }),
  getBookChatCompletions: vi.fn().mockResolvedValue([]),
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
  upsertBookChatCompletion: vi.fn().mockResolvedValue(undefined),
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
    myReading: (profileId: string) => ['my-reading-books', profileId],
    room: (roomId: string) => ['reading-room', roomId],
  },
  getManagedBookChat,
  getReadingRoom,
}))

vi.mock('../../entities/video', () => ({
  createMuxThumbnailUrl: () => 'https://image.mux.com/playback-id/thumbnail.webp?token=token',
  getVideoFilterMembers,
  getVideoPosts,
  getVideoThumbnailAuthorizations,
  mapVideoThumbnailAuthorizations: (authorizations: Array<{ postId: string }>) =>
    new Map(authorizations.map((authorization) => [authorization.postId, authorization])),
  videoKeys: {
    byBookChat: (bookChatId: string) => ['video-posts', bookChatId],
    members: (roomId: string) => ['video-filter-members', roomId],
    thumbnails: (postIds: string[]) => ['video-thumbnails', postIds],
  },
}))

vi.mock('../../entities/reading-room', () => ({
  readingRoomKeys: { all: ['reading-rooms'] },
}))

vi.mock('../../entities/room-management', () => ({
  createManagedRoomInvite,
  getRoomManagement,
  roomManagementKeys: { detail: (roomId: string) => ['room-management', roomId] },
}))

vi.mock('../../entities/reading-progress', () => ({
  readingProgressKeys: { byProfile: (profileId: string) => ['reading-progresses', profileId] },
}))

vi.mock('../../entities/book-completion', () => ({
  bookCompletionKeys: {
    byChat: (bookChatId: string) => ['book-completions', bookChatId],
    myBookChatIds: (profileId: string) => ['my-completion-book-chat-ids', profileId],
    myBooks: (profileId: string) => ['my-completed-books', profileId],
  },
  getBookChatCompletions,
  removeBookChatCompletion: vi.fn(),
  upsertBookChatCompletion,
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
    getVideoFilterMembers.mockClear()
    getVideoPosts.mockClear()
    getVideoPosts.mockResolvedValue([])
    getBookChatCompletions.mockClear()
    getBookChatCompletions.mockResolvedValue([])
    upsertBookChatCompletion.mockClear()
    upsertBookChatCompletion.mockResolvedValue(undefined)
    videoUploadState.isUploadingVideo = false
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

  it('shows the bookshop in the header and the selected book as the discussion title', async () => {
    renderBookDiscussionPage()

    expect(await screen.findByText('금요일 아침 책방')).toBeInTheDocument()
    expect(screen.getByText('책 대화')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '미움받을 용기' })).toBeInTheDocument()
  })

  it('opens a square seventy-percent video preview in the immersive player', async () => {
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

    const preview = await screen.findByRole('button', { name: '민규님의 영상 보기' })
    expect(preview).toHaveClass('w-[70%]')
    expect(preview.querySelector('.aspect-square')).toBeInTheDocument()
    expect(getVideoThumbnailAuthorizations).toHaveBeenCalledWith(undefined, ['video-1'])

    fireEvent.click(preview)

    expect(screen.getByText('몰입형 영상 화면')).toBeInTheDocument()
  })

  it('opens the message actions as a speech bubble above the composer', () => {
    renderBookDiscussionPage()

    fireEvent.click(screen.getByRole('button', { name: '메시지 추가 메뉴 열기' }))

    const actionMenu = screen.getByText('페이지 라벨').closest('.talkhugam-chat-action-menu')
    expect(actionMenu).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '영상 올리기' })).toBeInTheDocument()
  })

  it('keeps every chat action in the same two-column grid', () => {
    renderBookDiscussionPage()

    fireEvent.click(screen.getByRole('button', { name: '메시지 추가 메뉴 열기' }))

    expect(screen.getByRole('button', { name: '완독 기록' })).not.toHaveClass('col-span-2')
  })

  it('aligns the add button, message input, and send button in one composer grid', () => {
    renderBookDiscussionPage()

    const input = screen.getByLabelText('메시지 입력')

    expect(input.parentElement?.parentElement).toHaveClass('talkhugam-chat-composer-row')
  })

  it('opens the completion review form from the plus menu before it saves a personal completion record', async () => {
    renderBookDiscussionPage()

    expect(screen.queryByRole('button', { name: '완독하기' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '메시지 추가 메뉴 열기' }))
    fireEvent.click(screen.getByRole('button', { name: '완독 기록' }))

    expect(await screen.findByRole('dialog', { name: '완독 기록' })).toBeInTheDocument()

    expect(upsertBookChatCompletion).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByRole('button', { name: '완독하기' }))
    fireEvent.click(screen.getByRole('button', { name: '5점' }))
    fireEvent.change(screen.getByLabelText('총평 (선택)'), {
      target: { value: '대화가 오래 남는 책이에요.' },
    })
    fireEvent.click(screen.getByRole('button', { name: '완독 기록 저장' }))

    await vi.waitFor(() =>
      expect(upsertBookChatCompletion).toHaveBeenCalledWith(undefined, {
        bookChatId: 'book-1',
        rating: 5,
        review: '대화가 오래 남는 책이에요.',
      }),
    )
  })

  it('updates the completion count immediately after saving a personal completion', async () => {
    const savedCompletion = {
      completedAt: '2026-07-19T00:00:00.000Z',
      displayName: '민규',
      isMe: true,
      profileId: '00000000-0000-0000-0000-000000000001',
      rating: null,
      review: null,
    }
    getBookChatCompletions
      .mockResolvedValueOnce([])
      .mockImplementation(() => Promise.resolve([savedCompletion]))
    renderBookDiscussionPage()

    fireEvent.click(screen.getByRole('button', { name: '메시지 추가 메뉴 열기' }))
    fireEvent.click(screen.getByRole('button', { name: '완독 기록' }))
    fireEvent.click(await screen.findByRole('button', { name: '완독하기' }))
    fireEvent.click(screen.getByRole('button', { name: '완독 기록 저장' }))

    expect(await screen.findByText('함께 읽은 기록 · 1명 완독')).toBeInTheDocument()
    expect(screen.getByText('내 완독')).toBeInTheDocument()
  })

  it('keeps the saved completion visible while the background refresh is pending', async () => {
    const refresh = createDeferredValue<
      Array<{
        completedAt: string
        displayName: string
        isMe: boolean
        profileId: string
        rating: number | null
        review: string | null
      }>
    >()
    getBookChatCompletions.mockResolvedValueOnce([]).mockReturnValueOnce(refresh.promise)
    renderBookDiscussionPage()

    fireEvent.click(screen.getByRole('button', { name: '메시지 추가 메뉴 열기' }))
    fireEvent.click(screen.getByRole('button', { name: '완독 기록' }))
    fireEvent.click(await screen.findByRole('button', { name: '완독하기' }))
    fireEvent.click(screen.getByRole('button', { name: '완독 기록 저장' }))

    expect(await screen.findByText('함께 읽은 기록 · 1명 완독')).toBeInTheDocument()
    expect(screen.getByText('내 완독')).toBeInTheDocument()

    refresh.resolve([])
  })

  it('refreshes every personal reading view after saving a completion', async () => {
    const { queryClient } = renderBookDiscussionPage()
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
    getBookChatCompletions.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        completedAt: '2026-07-19T00:00:00.000Z',
        displayName: '민규',
        isMe: true,
        profileId: '00000000-0000-0000-0000-000000000001',
        rating: null,
        review: null,
      },
    ])

    fireEvent.click(screen.getByRole('button', { name: '메시지 추가 메뉴 열기' }))
    fireEvent.click(screen.getByRole('button', { name: '완독 기록' }))
    fireEvent.click(await screen.findByRole('button', { name: '완독하기' }))
    fireEvent.click(screen.getByRole('button', { name: '완독 기록 저장' }))

    await vi.waitFor(() =>
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['my-reading-books', '00000000-0000-0000-0000-000000000001'],
      }),
    )
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['reading-progresses', '00000000-0000-0000-0000-000000000001'],
    })
  })

  it('shows the personal completion marker and reopens saved values for editing', async () => {
    getBookChatCompletions.mockResolvedValueOnce([
      {
        completedAt: '2026-07-19T00:00:00.000Z',
        displayName: '민규',
        isMe: true,
        profileId: '00000000-0000-0000-0000-000000000001',
        rating: 4,
        review: '다시 펼쳐 보고 싶은 책이에요.',
      },
    ])
    renderBookDiscussionPage()

    fireEvent.click(screen.getByRole('button', { name: '메시지 추가 메뉴 열기' }))
    fireEvent.click(screen.getByRole('button', { name: '완독 기록' }))

    expect(await screen.findByText('내 완독')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '완독 기록 수정' }))

    expect(screen.getByRole('button', { name: '4점' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('총평 (선택)')).toHaveValue('다시 펼쳐 보고 싶은 책이에요.')
    expect(screen.getByRole('button', { name: '완독 기록 수정' })).toBeInTheDocument()
  })

  it('closes the action bubble when the user taps outside it', () => {
    renderBookDiscussionPage()
    fireEvent.click(screen.getByRole('button', { name: '메시지 추가 메뉴 열기' }))

    fireEvent.pointerDown(document.body)

    expect(screen.queryByText('페이지 라벨')).not.toBeInTheDocument()
  })

  it('closes the action bubble with Escape', () => {
    renderBookDiscussionPage()
    fireEvent.click(screen.getByRole('button', { name: '메시지 추가 메뉴 열기' }))

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(screen.queryByText('페이지 라벨')).not.toBeInTheDocument()
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

  it('preserves the draft, labels, and mentions after an outside click closes the menu', async () => {
    renderBookDiscussionPage()
    await prepareComposerState()

    fireEvent.pointerDown(document.body)

    expectComposerState()
  })

  it('preserves the draft, labels, and mentions after Escape closes the menu', async () => {
    renderBookDiscussionPage()
    await prepareComposerState()

    fireEvent.keyDown(window, { key: 'Escape' })

    expectComposerState()
  })

  it('preserves the draft, labels, and mentions after the plus button closes the menu', async () => {
    renderBookDiscussionPage()
    await prepareComposerState()

    fireEvent.click(screen.getByRole('button', { name: '메시지 추가 메뉴 열기' }))
    fireEvent.click(screen.getByRole('button', { name: '메시지 추가 메뉴 닫기' }))

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

  it.each([
    ['outside click', () => fireEvent.pointerDown(document.body)],
    [
      'close button',
      () => fireEvent.click(screen.getByRole('button', { name: '메시지 추가 메뉴 닫기' })),
    ],
    ['Escape', () => fireEvent.keyDown(window, { key: 'Escape' })],
  ])(
    'returns to label selection and keeps only the message draft after closing with %s',
    (_, closeMenu) => {
      renderBookDiscussionPage()
      openPageLabelEditor()
      fireEvent.change(screen.getByLabelText('페이지 번호'), { target: { value: '87' } })
      fireEvent.change(screen.getByLabelText('메시지 입력'), {
        target: { value: '이 문장을 기억할게요' },
      })

      closeMenu()
      fireEvent.click(screen.getByRole('button', { name: '메시지 추가 메뉴 열기' }))

      expect(screen.getByRole('button', { name: '페이지 라벨' })).toBeInTheDocument()
      expect(screen.queryByLabelText('페이지 번호')).not.toBeInTheDocument()
      expect(screen.getByLabelText('메시지 입력')).toHaveValue('이 문장을 기억할게요')

      fireEvent.click(screen.getByRole('button', { name: '페이지 라벨' }))
      expect(screen.getByLabelText('페이지 번호')).toHaveValue('')
    },
  )

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

  it('clears only the submitted label draft, closes the menu, and focuses the message input', () => {
    renderBookDiscussionPage()
    openPageLabelEditor()
    fireEvent.change(screen.getByLabelText('페이지 번호'), { target: { value: '87' } })

    fireEvent.click(screen.getByRole('button', { name: '라벨 추가' }))

    expect(screen.getByText('페이지 87')).toBeInTheDocument()
    expect(screen.queryByLabelText('페이지 번호')).not.toBeInTheDocument()
    expect(screen.getByLabelText('메시지 입력')).toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: '메시지 추가 메뉴 열기' }))
    fireEvent.click(screen.getByRole('button', { name: '페이지 라벨' }))
    expect(screen.getByLabelText('페이지 번호')).toHaveValue('')
  })

  it('adds a label when Enter is pressed in the label input', () => {
    renderBookDiscussionPage()
    openPageLabelEditor()
    fireEvent.change(screen.getByLabelText('페이지 번호'), { target: { value: '87' } })

    fireEvent.keyDown(screen.getByLabelText('페이지 번호'), { key: 'Enter' })

    expect(screen.getByText('페이지 87')).toBeInTheDocument()
    expect(screen.getByLabelText('메시지 입력')).toHaveFocus()
  })

  it('keeps an invalid label draft open so the user can correct it', () => {
    renderBookDiscussionPage()
    openPageLabelEditor()
    fireEvent.change(screen.getByLabelText('페이지 번호'), { target: { value: '   ' } })

    fireEvent.click(screen.getByRole('button', { name: '라벨 추가' }))

    expect(screen.getByLabelText('페이지 번호')).toHaveValue('   ')
    expect(screen.getByRole('button', { name: '메시지 추가 메뉴 닫기' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
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

    const status = await screen.findByRole('status', { name: '영상 준비 중…' })
    expect(status.querySelector('.talkhugam-book-loader')).toBeInTheDocument()
  })
})

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
