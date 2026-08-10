import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BookDiscussionPage } from './BookDiscussionPage'

const {
  createPost,
  createReply,
  getPostReactions,
  createManagedRoomInvite,
  getRoomManagement,
  getManagedBookChat,
  getBookChatCompletions,
  getReadingRoom,
  getPosts,
  getVideoFilterMembers,
  getVideoPlaybackAuthorization,
  getVideoPosts,
  getVideoThumbnailAuthorizations,
  parsePostForm,
  requestManagedRoomInvite,
  shouldSubmitMessage,
  togglePostReaction,
  upsertBookChatCompletion,
  videoUploadState,
} = vi.hoisted(() => ({
  createPost: vi.fn().mockResolvedValue('post-1'),
  createReply: vi.fn().mockResolvedValue('reply-1'),
  getPostReactions: vi.fn().mockResolvedValue(new Map()),
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
  getVideoPlaybackAuthorization: vi.fn().mockResolvedValue({
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
  shouldSubmitMessage: vi.fn((key: string, shiftKey: boolean) => key === 'Enter' && !shiftKey),
  togglePostReaction: vi.fn().mockResolvedValue(undefined),
  upsertBookChatCompletion: vi.fn().mockResolvedValue(undefined),
  videoUploadState: { isUploadingVideo: false },
}))

vi.mock('../../entities/post', () => ({
  createPost,
  createReply,
  getPostReactions,
  getPosts,
  parsePostForm,
  postKeys: {
    byBookChat: (bookChatId: string) => ['posts', bookChatId],
    reactions: (bookChatId: string) => ['post-reactions', bookChatId],
  },
  shouldSubmitMessage,
  togglePostReaction,
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

vi.mock('../../shared/ui/LazyMuxVideoPlayer', () => ({
  LazyMuxVideoPlayer: ({ autoPlay, playbackId }: { autoPlay?: boolean; playbackId: string }) => (
    <div aria-label="책갈피 영상 재생기" data-autoplay={String(Boolean(autoPlay))}>
      {playbackId}
    </div>
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

vi.mock('frimousse', async () => {
  const React = await import('react')
  const pickerGroups = [
    {
      emojis: ['😀', '😃', '😄', '😁', '😆', '❤️', '👍', '👏', '😊', '😮', '😂', '😍'],
      label: 'Smileys & Emotion',
    },
    { emojis: ['🌐', '🌍', '🌎', '🌏', '🗺️', '🔥', '🌊'], label: 'Travel & Places' },
    { emojis: ['🎃', '🎄'], label: 'Activities' },
    { emojis: ['🏧', '🚮'], label: 'Symbols' },
    { emojis: ['🏁', '🚩'], label: 'Flags' },
  ]
  const EmojiPickerContext = React.createContext<(emoji: { emoji: string; label: string }) => void>(
    () => {},
  )

  /** 테스트에서 선택 이벤트를 공유하는 Frimousse 루트 대체 컴포넌트를 렌더링한다. */
  function Root({
    children,
    onEmojiSelect,
    ...props
  }: {
    children: React.ReactNode
    onEmojiSelect?: (emoji: { emoji: string; label: string }) => void
  } & React.ComponentProps<'div'>) {
    return (
      <EmojiPickerContext.Provider value={onEmojiSelect ?? (() => {})}>
        <div {...props}>{children}</div>
      </EmojiPickerContext.Provider>
    )
  }

  /** 테스트에서 검색 입력의 접근성 계약만 유지한다. */
  function Search(props: React.ComponentProps<'input'>) {
    return <input {...props} type="search" />
  }

  /** 테스트에서 피커 viewport의 자식 컴포넌트를 그대로 렌더링한다. */
  function Viewport({ children, ...props }: React.ComponentProps<'div'>) {
    return <div {...props}>{children}</div>
  }

  /** 테스트에서는 비동기 로딩 표시를 생략한다. */
  function Loading() {
    return null
  }

  /** 테스트에서는 빈 결과 표시를 생략한다. */
  function Empty() {
    return null
  }

  /** 테스트에서 선택 가능한 Frimousse 이모지 목록을 단순 버튼으로 렌더링한다. */
  function List({
    components,
    ...props
  }: {
    components?: {
      CategoryHeader?: React.ComponentType<{ category: { label: string } }>
      Emoji?: React.ComponentType<
        React.ComponentProps<'button'> & { emoji: { emoji: string; isActive: boolean } }
      >
      Row?: React.ComponentType<React.ComponentProps<'div'>>
    }
  } & React.ComponentProps<'div'>) {
    const selectEmoji = React.useContext(EmojiPickerContext)
    const CategoryHeader = components?.CategoryHeader
    const Emoji = components?.Emoji
    const Row = components?.Row ?? 'div'

    return (
      <div {...props}>
        {pickerGroups.map((group) => (
          <React.Fragment key={group.label}>
            {CategoryHeader ? <CategoryHeader category={{ label: group.label }} /> : null}
            <Row className="mb-2 grid grid-cols-5 gap-2">
              {group.emojis.map((emoji) =>
                Emoji ? (
                  <div key={emoji} className="relative">
                    <Emoji
                      aria-hidden="true"
                      emoji={{ emoji, isActive: false }}
                      tabIndex={-1}
                      type="button"
                    />
                    <button
                      aria-label={`${emoji} 반응 남기기`}
                      className="absolute inset-0"
                      onClick={() => selectEmoji({ emoji, label: emoji })}
                      type="button"
                    />
                  </div>
                ) : (
                  <button
                    aria-label={`${emoji} 반응 남기기`}
                    className="grid size-11 place-items-center rounded-md p-0 text-[28px]"
                    key={emoji}
                    onClick={() => selectEmoji({ emoji, label: emoji })}
                    type="button"
                  >
                    {emoji}
                  </button>
                ),
              )}
            </Row>
          </React.Fragment>
        ))}
      </div>
    )
  }

  return { EmojiPicker: { Empty, List, Loading, Root, Search, Viewport } }
})

describe('BookDiscussionPage', () => {
  afterEach(() => {
    cleanup()
    createPost.mockClear()
    createReply.mockClear()
    getPostReactions.mockClear()
    getPostReactions.mockResolvedValue(new Map())
    togglePostReaction.mockClear()
    togglePostReaction.mockResolvedValue(undefined)
    getPosts.mockClear()
    getPosts.mockResolvedValue([])
    getVideoThumbnailAuthorizations.mockClear()
    getVideoThumbnailAuthorizations.mockResolvedValue([])
    getVideoFilterMembers.mockClear()
    getVideoPlaybackAuthorization.mockClear()
    getVideoPlaybackAuthorization.mockResolvedValue({
      playbackId: 'playback-id',
      thumbnailToken: 'thumbnail-token',
      token: 'playback-token',
    })
    getVideoPosts.mockClear()
    getVideoPosts.mockResolvedValue([])
    requestManagedRoomInvite.mockClear()
    requestManagedRoomInvite.mockResolvedValue(true)
    getBookChatCompletions.mockReset()
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
    const messageBubble = message.closest('div')
    const messageGroup = messageBubble?.parentElement

    expect(messageGroup).toHaveClass('max-w-[70%]')
    expect(messageGroup).toHaveClass('w-fit')
  })

  it('aligns my text and reply messages to the right', async () => {
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
    renderBookDiscussionPage()

    expect((await screen.findByText('내 독후감')).closest('li')).toHaveClass('justify-end')
    expect(screen.getByText('내 답글').closest('li')).toHaveClass('justify-end')
    expect(screen.getByText('다른 멤버의 독후감').closest('li')).toHaveClass('justify-start')
  })

  it('keeps a short reply bubble wide enough to avoid awkward vertical wrapping', async () => {
    getPosts.mockResolvedValueOnce([
      {
        authorMemberId: 'b3c8b282-6092-45f8-b15f-523a9dcd0eab',
        authorName: '민수',
        body: 'ㄷㄷ',
        createdAt: '2026-07-18T00:00:00.000Z',
        depth: 0,
        id: 'post-1',
        labels: [],
        rootPostId: null,
      },
      {
        authorMemberId: '0ce71cea-b4ea-4e18-a605-bf2088d4ba15',
        authorName: '나',
        body: 'ㅋㅋ',
        createdAt: '2026-07-18T00:01:00.000Z',
        depth: 1,
        id: 'reply-1',
        labels: [],
        rootPostId: 'post-1',
      },
    ])
    renderBookDiscussionPage()

    expect((await screen.findByText('ㅋㅋ')).closest('div')).toHaveClass('min-w-36')
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

  it('keeps reply and reaction actions hidden until the message is hovered', async () => {
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

    expect(screen.queryByText('답글 남기기')).not.toBeInTheDocument()
    const message = await screen.findByText('인상 깊었어요')
    fireEvent.mouseEnter(message.closest('article')!)

    expect(screen.queryByRole('button', { name: '서연에게 답글' })).not.toBeInTheDocument()

    fireEvent.mouseEnter(screen.getByLabelText('서연의 메시지'))

    expect(screen.getByRole('button', { name: '서연에게 답글' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '이모지 반응 열기' })).toHaveClass('!size-11')
    expect(screen.getByRole('button', { name: '❤️ 반응 남기기' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '👍 반응 남기기' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '👎 반응 남기기' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '😢 반응 남기기' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '👍 반응 남기기' })).toHaveClass('!bg-transparent')
    expect(screen.getByRole('button', { name: '서연에게 답글' })).toHaveClass('order-last')
    expect(screen.getByLabelText('서연의 메시지')).toHaveClass('w-fit')
    expect(screen.getByLabelText('메시지 빠른 액션')).not.toHaveClass('-mx-2')
    expect(screen.getByLabelText('메시지 빠른 액션')).toHaveClass('mt-1')
    expect(screen.getByLabelText('메시지 빠른 액션').firstElementChild).toHaveClass('justify-start')

    fireEvent.click(screen.getByRole('button', { name: '이모지 반응 열기' }))
    fireEvent.mouseLeave(screen.getByLabelText('서연의 메시지').parentElement!)

    expect(screen.getByRole('group', { name: 'Talk후감 이모티콘 패키지' })).toBeInTheDocument()
    expect(
      (await screen.findAllByRole('button', { name: '❤️ 반응 남기기' })).length,
    ).toBeGreaterThanOrEqual(2)
  })

  it('aligns my quick message actions to the right edge of the bubble', async () => {
    getPosts.mockResolvedValueOnce([
      {
        authorMemberId: '0ce71cea-b4ea-4e18-a605-bf2088d4ba15',
        authorName: '나',
        body: '내가 남긴 문장',
        createdAt: '2026-07-18T00:00:00.000Z',
        depth: 0,
        id: 'f17c0d6d-3e6e-4b7f-a1f1-5d652aa2a85e',
        labels: [],
        rootPostId: null,
      },
    ])
    renderBookDiscussionPage()

    fireEvent.mouseEnter(await screen.findByLabelText('나의 메시지'))

    expect(screen.getByLabelText('메시지 빠른 액션')).toHaveClass('items-end')
    expect(screen.getByLabelText('메시지 빠른 액션').firstElementChild).toHaveClass('justify-end')
  })

  it('shows the compact actions after a long press on mobile-like input', async () => {
    getPosts.mockResolvedValueOnce([
      {
        authorName: '서연',
        body: '길게 눌러요',
        createdAt: '2026-07-18T00:00:00.000Z',
        depth: 0,
        id: 'f17c0d6d-3e6e-4b7f-a1f1-5d652aa2a85e',
        labels: [],
        rootPostId: null,
      },
    ])
    renderBookDiscussionPage()

    await screen.findByText('길게 눌러요')
    fireEvent.pointerDown(screen.getByLabelText('서연의 메시지'))

    expect(await screen.findByRole('button', { name: '서연에게 답글' })).toBeInTheDocument()
  })

  it('shows the bookshop in the header and the selected book with conversation and bookmark tabs', async () => {
    renderBookDiscussionPage()

    expect(await screen.findByText('금요일 아침 책방')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '미움받을 용기' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '대화' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: '책갈피' })).toHaveAttribute('aria-selected', 'false')
  })

  it('plays a rectangular bookmark video preview in place', async () => {
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

    await screen.findByRole('tab', { name: '책갈피' })
    expect(screen.queryByRole('button', { name: '민규님의 영상 보기' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: '책갈피' }))

    const preview = await screen.findByRole('button', { name: '민규님의 영상 보기' })
    expect(preview).toHaveClass('w-full')
    expect(preview).toHaveClass('!aspect-[3/1]')
    expect(preview.querySelector('.aspect-square')).not.toBeInTheDocument()
    expect(getVideoThumbnailAuthorizations).toHaveBeenCalledWith(undefined, ['video-1'])

    fireEvent.click(preview)

    expect(await screen.findByLabelText('책갈피 영상 재생기')).toHaveAttribute(
      'data-autoplay',
      'true',
    )
    expect(getVideoPlaybackAuthorization).toHaveBeenCalledWith(undefined, 'video-1')
    expect(screen.queryByText('몰입형 영상 화면')).not.toBeInTheDocument()
  })

  it('opens only label registration in the message sheet', () => {
    renderBookDiscussionPage()

    fireEvent.click(screen.getByRole('button', { name: '메시지 추가 메뉴 열기' }))

    expect(screen.getByRole('dialog', { name: '메시지 추가' })).toHaveClass(
      'seed-menu-sheet__content',
    )
    expect(screen.getByRole('button', { name: '라벨 등록' })).toHaveClass(
      'talkhugam-action-sheet-choice',
    )
    expect(screen.queryByRole('button', { name: '영상 기록' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '영상 올리기' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '완독 기록' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '책방 초대하기' })).not.toBeInTheDocument()
  })

  it('moves videos into the bookmark tab and keeps bookmark creation fixed', async () => {
    getVideoPosts.mockResolvedValueOnce([
      {
        authorName: '민규',
        body: '희미한 빛도 오래 바라보면 방향이 된다.',
        createdAt: '2026-07-18T00:00:00.000Z',
        id: 'video-1',
        status: 'ready',
      },
    ])
    renderBookDiscussionPage()

    await screen.findByRole('tab', { name: '책갈피' })
    expect(screen.queryByRole('button', { name: '민규님의 영상 보기' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: '책갈피' }))

    expect(screen.queryByLabelText('메시지 입력')).not.toBeInTheDocument()
    expect(screen.getByText('영감을 받은 특별한 구절에 책갈피를 꽂아보아요.')).toBeInTheDocument()
    expect(screen.queryByText('책갈피', { selector: 'p' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '함께 읽은 순간' })).not.toBeInTheDocument()
    expect(screen.queryByText('영상으로 남긴 책갈피를 모아 봐요.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '책갈피 남기기' }).parentElement).toHaveClass('fixed')
    expect(screen.getByText('희미한 빛도 오래 바라보면 방향이 된다.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '책갈피 남기기' }))

    expect(screen.getByText('책갈피 작성 화면')).toBeInTheDocument()
  })

  it('invites the first bookmark from an empty bookmark tab', async () => {
    renderBookDiscussionPage()

    fireEvent.click(await screen.findByRole('tab', { name: '책갈피' }))

    expect(screen.getByText('영감을 받은 특별한 구절에 책갈피를 꽂아보아요.')).toBeInTheDocument()
    expect(screen.getByText('아직 남긴 책갈피가 없어요.')).toBeInTheDocument()
    expect(screen.getByText('마음에 든 문장을 짧은 영상으로 남겨 보세요.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '책갈피 남기기' })).toBeInTheDocument()
  })

  it('opens the label kind choices only after selecting label registration', () => {
    renderBookDiscussionPage()

    fireEvent.click(screen.getByRole('button', { name: '메시지 추가 메뉴 열기' }))

    fireEvent.click(screen.getByRole('button', { name: '라벨 등록' }))

    expect(screen.getByRole('button', { name: '페이지 라벨' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '챕터 라벨' })).toBeInTheDocument()
  })

  it('aligns the add button, message input, and send button in one composer grid', () => {
    renderBookDiscussionPage()

    const input = screen.getByLabelText('메시지 입력')

    expect(input.closest('.talkhugam-chat-composer-row')).toBeInTheDocument()
  })

  it('keeps the completion action out of the plus menu', async () => {
    renderBookDiscussionPage()

    expect(screen.queryByRole('button', { name: '완독하기' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '메시지 추가 메뉴 열기' }))
    expect(screen.queryByRole('button', { name: '완독 기록' })).not.toBeInTheDocument()
    expect(upsertBookChatCompletion).not.toHaveBeenCalled()
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

  it('keeps loaded bookmarks visible when the post query fails', async () => {
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
    fireEvent.click(screen.getByRole('tab', { name: '책갈피' }))

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

    await openMessageActions('인상 깊었어요')
    fireEvent.click(screen.getByRole('button', { name: '서연에게 답글' }))
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

  it('submits one post when Enter is pressed again before the first request finishes', async () => {
    const postRequest = createDeferredValue<string>()
    createPost.mockReturnValueOnce(postRequest.promise)
    renderBookDiscussionPage()

    const messageInput = screen.getByLabelText('메시지 입력')
    fireEvent.change(messageInput, { target: { value: '한 번만 남겨요.' } })
    fireEvent.keyDown(messageInput, { key: 'Enter' })
    fireEvent.keyDown(messageInput, { key: 'Enter' })

    await vi.waitFor(() => expect(createPost).toHaveBeenCalledTimes(1))

    postRequest.resolve('post-1')
  })

  it('submits one reply when Enter is pressed again before the first request finishes', async () => {
    const replyRequest = createDeferredValue<string>()
    createReply.mockReturnValueOnce(replyRequest.promise)
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
    await openMessageActions('인상 깊었어요')
    fireEvent.click(screen.getByRole('button', { name: '서연에게 답글' }))

    const messageInput = screen.getByLabelText('메시지 입력')
    fireEvent.change(messageInput, { target: { value: '한 번만 답해요.' } })
    fireEvent.keyDown(messageInput, { key: 'Enter' })
    fireEvent.keyDown(messageInput, { key: 'Enter' })

    await vi.waitFor(() => expect(createReply).toHaveBeenCalledTimes(1))

    replyRequest.resolve('reply-1')
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
    await openMessageActions('인상 깊었어요')
    fireEvent.click(screen.getByRole('button', { name: '서연에게 답글' }))
    await insertMention('저도요')

    fireEvent.click(screen.getByRole('button', { name: '전송' }))

    await vi.waitFor(() => {
      expect(createReply).toHaveBeenCalledTimes(1)
      expect(screen.queryByText('서연에게 답글')).not.toBeInTheDocument()
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
    await openMessageActions('인상 깊었어요')
    fireEvent.click(screen.getByRole('button', { name: '서연에게 답글' }))
    await insertMention('저도요')

    fireEvent.click(screen.getByRole('button', { name: '전송' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '독후감을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.',
    )
    expect(screen.getByText('서연에게 답글')).toBeInTheDocument()
    expect(screen.getByLabelText('메시지 입력')).toHaveValue('@민수 저도요')
  })

  it('shows the reply target above the composer and changes the placeholder', async () => {
    getPosts.mockResolvedValueOnce([
      {
        authorName: '정민규',
        body: '아침은 이미 잔뜩 먹었고 커피도 마셨어요.',
        createdAt: '2026-07-18T00:00:00.000Z',
        depth: 0,
        id: 'f17c0d6d-3e6e-4b7f-a1f1-5d652aa2a85e',
        labels: [],
        rootPostId: null,
      },
    ])
    renderBookDiscussionPage()
    await openMessageActions('아침은 이미 잔뜩 먹었고 커피도 마셨어요.')

    fireEvent.click(screen.getByRole('button', { name: '정민규에게 답글' }))

    expect(screen.getByText('정민규에게 답글')).toBeInTheDocument()
    expect(screen.getAllByText('아침은 이미 잔뜩 먹었고 커피도 마셨어요.')[1]).toHaveClass(
      'truncate',
    )
    expect(screen.getByPlaceholderText('답글을 입력하세요.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '답글 취소' }))
    expect(screen.queryByText('정민규에게 답글')).not.toBeInTheDocument()
  })

  it('focuses the message input after choosing a reply target', async () => {
    const scrollIntoView = vi.fn()
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView
    getPosts.mockResolvedValueOnce([
      {
        authorName: '서연',
        body: '여기에 바로 답하고 싶어요.',
        createdAt: '2026-07-18T00:00:00.000Z',
        depth: 0,
        id: 'f17c0d6d-3e6e-4b7f-a1f1-5d652aa2a85e',
        labels: [],
        rootPostId: null,
      },
    ])
    renderBookDiscussionPage()
    await openMessageActions('여기에 바로 답하고 싶어요.')

    fireEvent.click(screen.getByRole('button', { name: '서연에게 답글' }))

    await vi.waitFor(() => expect(screen.getByLabelText('메시지 입력')).toHaveFocus())
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
  })

  it('shows an optimistic coral reaction immediately after a quick emoji is pressed', async () => {
    const reactionRequest = createDeferredValue<void>()
    togglePostReaction.mockReturnValueOnce(reactionRequest.promise)
    getPosts.mockResolvedValueOnce([
      {
        authorName: '서연',
        body: '이 문장이 좋아요',
        createdAt: '2026-07-18T00:00:00.000Z',
        depth: 0,
        id: 'f17c0d6d-3e6e-4b7f-a1f1-5d652aa2a85e',
        labels: [],
        rootPostId: null,
      },
    ])
    getPostReactions.mockResolvedValueOnce(
      new Map([
        [
          'f17c0d6d-3e6e-4b7f-a1f1-5d652aa2a85e',
          [
            {
              count: 2,
              emoji: '❤️',
              hasReacted: true,
              postId: 'f17c0d6d-3e6e-4b7f-a1f1-5d652aa2a85e',
            },
          ],
        ],
      ]),
    )
    renderBookDiscussionPage()
    await openMessageActions('이 문장이 좋아요')

    expect(await screen.findByRole('button', { name: '❤️ 반응 2개, 내가 남김' })).toHaveClass(
      'bg-primary/10',
    )
    fireEvent.click(screen.getByRole('button', { name: '👍 반응 남기기' }))

    expect(await screen.findByRole('button', { name: '👍 반응 1개, 내가 남김' })).toHaveClass(
      'bg-primary/10',
    )
    await vi.waitFor(() =>
      expect(togglePostReaction).toHaveBeenCalledWith(
        undefined,
        'f17c0d6d-3e6e-4b7f-a1f1-5d652aa2a85e',
        '👍',
      ),
    )
    reactionRequest.resolve(undefined)
  })

  it('opens a reliable expanded emoji palette from the plus button', async () => {
    const reactionRequest = createDeferredValue<void>()
    togglePostReaction.mockReturnValueOnce(reactionRequest.promise)
    getPosts.mockResolvedValueOnce([
      {
        authorName: '서연',
        body: '다른 이모지도 남겨요',
        createdAt: '2026-07-18T00:00:00.000Z',
        depth: 0,
        id: 'f17c0d6d-3e6e-4b7f-a1f1-5d652aa2a85e',
        labels: [],
        rootPostId: null,
      },
    ])
    renderBookDiscussionPage()
    await openMessageActions('다른 이모지도 남겨요')

    fireEvent.click(screen.getByRole('button', { name: '이모지 반응 열기' }))
    expect(screen.getByRole('group', { name: 'Talk후감 이모티콘 패키지' })).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: '🔥 반응 남기기' }))

    await vi.waitFor(() =>
      expect(togglePostReaction).toHaveBeenCalledWith(
        undefined,
        'f17c0d6d-3e6e-4b7f-a1f1-5d652aa2a85e',
        '🔥',
      ),
    )
    expect(await screen.findByRole('button', { name: '🔥 반응 1개, 내가 남김' })).toHaveClass(
      'bg-primary/10',
    )
    reactionRequest.resolve(undefined)
  })

  it('shows a Frimousse emoji package without visible explanatory copy', async () => {
    getPosts.mockResolvedValueOnce([
      {
        authorName: '서연',
        body: '패키지로 보여줘요',
        createdAt: '2026-07-18T00:00:00.000Z',
        depth: 0,
        id: 'f17c0d6d-3e6e-4b7f-a1f1-5d652aa2a85e',
        labels: [],
        rootPostId: null,
      },
    ])
    getPostReactions.mockResolvedValueOnce(
      new Map([
        [
          'f17c0d6d-3e6e-4b7f-a1f1-5d652aa2a85e',
          [
            {
              count: 2,
              emoji: '❤️',
              hasReacted: true,
              postId: 'f17c0d6d-3e6e-4b7f-a1f1-5d652aa2a85e',
            },
            {
              count: 1,
              emoji: '👍',
              hasReacted: false,
              postId: 'f17c0d6d-3e6e-4b7f-a1f1-5d652aa2a85e',
            },
          ],
        ],
      ]),
    )
    const scrollIntoView = vi.fn()
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView
    renderBookDiscussionPage()
    await openMessageActions('패키지로 보여줘요')

    expect(await screen.findByLabelText('메시지 반응 패키지')).toHaveClass('rounded-full')
    fireEvent.click(screen.getByRole('button', { name: '이모지 반응 열기' }))

    const emojiPackage = screen.getByRole('group', { name: 'Talk후감 이모티콘 패키지' })
    expect(emojiPackage).toHaveClass('w-80')
    expect(emojiPackage).toHaveClass('max-w-[calc(100vw-2rem)]')
    expect(screen.getByRole('tablist', { name: '이모지 카테고리' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Smileys & Emotion' })).toHaveTextContent('😀')
    expect(screen.getByRole('tab', { name: 'Travel & Places' })).toHaveTextContent('🌐')
    expect(screen.getByRole('tab', { name: 'Activities' })).toHaveTextContent('🎃')
    expect(screen.getByRole('tab', { name: 'Symbols' })).toHaveTextContent('🏧')
    expect(screen.getByRole('tab', { name: 'Flags' })).toHaveTextContent('🏁')
    expect(screen.getByRole('tab', { name: 'Smileys & Emotion' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.queryByRole('tab', { name: 'Category' })).not.toBeInTheDocument()
    expect(screen.queryByText('Category')).not.toBeInTheDocument()
    expect(screen.getByRole('tablist', { name: '이모지 카테고리' })).toHaveClass('w-full')
    expect(screen.getByRole('tablist', { name: '이모지 카테고리' })).toHaveClass(
      'talkhugam-category-scrollbar',
    )
    expect(screen.getByRole('tablist', { name: '이모지 카테고리' })).toHaveClass(
      'overflow-x-scroll',
    )
    expect(screen.queryByText('Smileys & Emotion')).not.toBeInTheDocument()
    expect(screen.getByLabelText('이모지 목록')).toHaveClass('talkhugam-emoji-scrollbar')
    expect(screen.getByLabelText('이모지 목록')).toHaveClass('h-72')
    expect(screen.queryByText('Talk후감 반응')).not.toBeInTheDocument()
    expect(screen.queryByText('기본 5개 + 자주 쓰는 반응')).not.toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: '이모지 검색' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: '🌊 반응 남기기' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'OS 기본 이모티콘 입력 안내' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Travel & Places' }))

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' })
    expect(screen.getByRole('tab', { name: 'Travel & Places' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
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
    fireEvent.click(screen.getByRole('button', { name: '라벨 등록' }))

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
    fireEvent.click(screen.getByRole('button', { name: '라벨 등록' }))
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

    fireEvent.click(screen.getByRole('tab', { name: '책갈피' }))

    const status = screen.getByRole('status', { name: '책갈피 영상을 올리고 있어요…' })
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

    fireEvent.click(await screen.findByRole('tab', { name: '책갈피' }))

    const status = await screen.findByRole('status', { name: '영상 준비 중…' })
    expect(status.querySelector('.talkhugam-book-loader')).toBeInTheDocument()
  })
})

function openPageLabelEditor() {
  fireEvent.click(screen.getByRole('button', { name: '메시지 추가 메뉴 열기' }))
  fireEvent.click(screen.getByRole('button', { name: '라벨 등록' }))
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

/** 테스트 메시지 버블에 포인터를 올려 숨겨진 메시지 액션을 연다. */
async function openMessageActions(message: string) {
  const messageText = await screen.findByText(message)
  fireEvent.mouseEnter(messageText.closest('[aria-label$="의 메시지"]')!)
}

/** 테스트 라우터와 QueryClient를 포함해 책 대화 페이지를 렌더링한다. */
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
          <Route path="/rooms/:roomId/books/:bookChatId/videos" element={<p>책갈피 작성 화면</p>} />
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
