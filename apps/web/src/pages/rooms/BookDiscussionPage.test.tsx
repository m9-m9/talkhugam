import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BookDiscussionPage } from './BookDiscussionPage'

const {
  createPost,
  createReply,
  getBookChatCompletions,
  getPosts,
  getVideoPlaybackAuthorization,
  getVideoFilterMembers,
  getVideoPosts,
  loadMuxPlayer,
  parsePostForm,
  videoUploadState,
} = vi.hoisted(() => ({
  createPost: vi.fn().mockResolvedValue('post-1'),
  createReply: vi.fn().mockResolvedValue('reply-1'),
  getBookChatCompletions: vi.fn().mockResolvedValue([]),
  getPosts: vi.fn().mockResolvedValue([]),
  getVideoPlaybackAuthorization: vi.fn(),
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
  loadMuxPlayer: vi.fn(),
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
  videoUploadState: { isUploadingVideo: false },
}))

vi.mock('@mux/mux-player-react', () => {
  loadMuxPlayer()
  return {
    default: ({ onError }: { onError?: () => void }) => (
      <button data-testid="mux-player" onClick={onError} type="button" />
    ),
  }
})

vi.mock('../../entities/post', () => ({
  createPost,
  createReply,
  getPosts,
  parsePostForm,
  postKeys: { byBookChat: (bookChatId: string) => ['posts', bookChatId] },
  shouldSubmitMessage: () => false,
}))

vi.mock('../../entities/video', () => ({
  getVideoPlaybackAuthorization,
  getVideoFilterMembers,
  getVideoPosts,
  videoKeys: {
    byBookChat: (bookChatId: string) => ['video-posts', bookChatId],
    members: (roomId: string) => ['video-filter-members', roomId],
  },
}))

vi.mock('../../entities/reading-room', () => ({
  readingRoomKeys: { all: ['reading-rooms'] },
}))

vi.mock('../../entities/book-completion', () => ({
  bookCompletionKeys: { byChat: (bookChatId: string) => ['book-completions', bookChatId] },
  getBookChatCompletions,
  removeBookChatCompletion: vi.fn(),
  upsertBookChatCompletion: vi.fn(),
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
    getVideoPlaybackAuthorization.mockClear()
    getVideoFilterMembers.mockClear()
    getVideoPosts.mockClear()
    getVideoPosts.mockResolvedValue([])
    loadMuxPlayer.mockClear()
    videoUploadState.isUploadingVideo = false
  })

  it('does not load the Mux player while the conversation has no ready video', async () => {
    renderBookDiscussionPage()

    await screen.findByRole('heading', { name: '읽고 느낀 걸 나눠요' })

    expect(loadMuxPlayer).not.toHaveBeenCalled()
  })

  it('loads the Mux player after the ready video playback authorization resolves', async () => {
    getVideoPosts.mockResolvedValueOnce([
      {
        authorName: '민규',
        body: null,
        createdAt: '2026-07-18T00:00:00.000Z',
        id: 'video-1',
        status: 'ready',
      },
    ])
    getVideoPlaybackAuthorization.mockResolvedValueOnce({
      playbackId: 'playback-id',
      thumbnailToken: 'thumbnail-token',
      token: 'playback-token',
    })
    renderBookDiscussionPage()

    expect(await screen.findByTestId('mux-player')).toBeInTheDocument()
    expect(loadMuxPlayer).toHaveBeenCalledOnce()
  })

  it('retries only the failed video message playback without replacing the chat screen', async () => {
    getVideoPosts.mockResolvedValueOnce([
      {
        authorName: '민규',
        body: null,
        createdAt: '2026-07-18T00:00:00.000Z',
        id: 'video-1',
        status: 'ready',
      },
    ])
    getVideoPlaybackAuthorization.mockResolvedValue({
      playbackId: 'playback-id',
      thumbnailToken: 'thumbnail-token',
      token: 'playback-token',
    })
    renderBookDiscussionPage()

    fireEvent.click(await screen.findByTestId('mux-player'))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '영상을 재생하지 못했어요. 다시 시도해 주세요.',
    )
    expect(screen.getByRole('heading', { name: '읽고 느낀 걸 나눠요' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '재생 다시 시도' }))

    await vi.waitFor(() => expect(getVideoPlaybackAuthorization).toHaveBeenCalledTimes(2))
    expect(await screen.findByTestId('mux-player')).toBeInTheDocument()
  })

  it('opens the message actions as a speech bubble above the composer', () => {
    renderBookDiscussionPage()

    fireEvent.click(screen.getByRole('button', { name: '메시지 추가 메뉴 열기' }))

    const actionMenu = screen.getByText('페이지 라벨').closest('.talkhugam-chat-action-menu')
    expect(actionMenu).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '영상 올리기' })).toBeInTheDocument()
  })

  it('lets the signed-in member begin a personal completion record', async () => {
    renderBookDiscussionPage()

    expect(await screen.findByRole('button', { name: '완독 기록하기' })).toBeInTheDocument()
    expect(screen.getByText('아직 완독한 멤버가 없어요.')).toBeInTheDocument()
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

  it('keeps a selected mention after closing the action bubble outside', async () => {
    renderBookDiscussionPage()
    openMentionSelector()

    expect(await screen.findByRole('button', { name: '민수 멘션' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '민수 멘션' }))
    fireEvent.pointerDown(document.body)

    expect(screen.queryByText('멤버 멘션')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '민수 멘션 삭제' })).toBeInTheDocument()
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

    fireEvent.click(screen.getByRole('button', { name: '메시지 추가 메뉴 닫기' }))

    expectComposerState()
  })

  it('does not offer the current user as a mention candidate', async () => {
    renderBookDiscussionPage()
    openMentionSelector()

    expect(await screen.findByRole('button', { name: '민수 멘션' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '나 멘션' })).not.toBeInTheDocument()
  })

  it('shows a retry action when loading mention members fails', async () => {
    getVideoFilterMembers.mockRejectedValueOnce(new Error('network'))
    renderBookDiscussionPage()
    openMentionSelector()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '멘션할 멤버를 불러오지 못했어요. 다시 시도해 주세요.',
    )
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    await vi.waitFor(() => expect(getVideoFilterMembers).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole('button', { name: '민수 멘션' })).toBeInTheDocument()
  })

  it('shows the normal empty state without an error or retry action', async () => {
    getVideoFilterMembers.mockResolvedValueOnce([])
    renderBookDiscussionPage()
    openMentionSelector()

    expect(await screen.findByText('멘션할 멤버가 없어요.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument()
  })

  it('shows a post query error instead of the empty conversation state and retries', async () => {
    getPosts.mockRejectedValueOnce(new Error('network'))
    renderBookDiscussionPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '감상을 불러오지 못했어요. 다시 시도해 주세요.',
    )
    expect(screen.queryByText('첫 감상을 남겨 보세요')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    await vi.waitFor(() => expect(getPosts).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('첫 감상을 남겨 보세요')).toBeInTheDocument()
  })

  it('shows a video query error instead of the empty conversation state and retries', async () => {
    getVideoPosts.mockRejectedValueOnce(new Error('network'))
    renderBookDiscussionPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '영상을 불러오지 못했어요. 다시 시도해 주세요.',
    )
    expect(screen.queryByText('첫 감상을 남겨 보세요')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    await vi.waitFor(() => expect(getVideoPosts).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('첫 감상을 남겨 보세요')).toBeInTheDocument()
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
      '감상을 불러오지 못했어요. 다시 시도해 주세요.',
    )
    expect(screen.getByRole('status', { name: '영상 준비 중…' })).toBeInTheDocument()
  })

  it('shows a post query error while the video query is still loading', async () => {
    const videoRequest = createDeferredValue<never[]>()
    getPosts.mockRejectedValueOnce(new Error('network'))
    getVideoPosts.mockReturnValueOnce(videoRequest.promise)
    renderBookDiscussionPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '감상을 불러오지 못했어요. 다시 시도해 주세요.',
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
    expect(await screen.findByText('첫 감상을 남겨 보세요')).toBeInTheDocument()
  })

  it('gives the mention removal action a 44px touch target', async () => {
    renderBookDiscussionPage()
    await prepareComposerState()

    expect(screen.getByRole('button', { name: '민수 멘션 삭제' })).toHaveClass(
      'min-h-11',
      'min-w-11',
    )
  })

  it('submits selected mentions with a new post', async () => {
    renderBookDiscussionPage()
    openMentionSelector()
    await screen.findByRole('button', { name: '민수 멘션' })
    fireEvent.click(screen.getByRole('button', { name: '민수 멘션' }))
    fireEvent.change(screen.getByLabelText('메시지 입력'), { target: { value: '함께 읽어 봐요' } })
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
    openMentionSelector()
    await screen.findByRole('button', { name: '민수 멘션' })
    fireEvent.click(screen.getByRole('button', { name: '민수 멘션' }))
    fireEvent.change(screen.getByLabelText('메시지 입력'), { target: { value: '저도요' } })
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
      expect(screen.queryByRole('button', { name: '민수 멘션 삭제' })).not.toBeInTheDocument()
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
    openMentionSelector()
    await screen.findByRole('button', { name: '민수 멘션' })
    fireEvent.click(screen.getByRole('button', { name: '민수 멘션' }))
    fireEvent.change(screen.getByLabelText('메시지 입력'), { target: { value: '저도요' } })

    fireEvent.click(screen.getByRole('button', { name: '전송' }))

    await vi.waitFor(() => {
      expect(createReply).toHaveBeenCalledTimes(1)
      expect(screen.queryByText('답글 남기기', { selector: 'p' })).not.toBeInTheDocument()
      expect(screen.getByLabelText('메시지 입력')).toHaveValue('')
      expect(screen.queryByRole('button', { name: '민수 멘션 삭제' })).not.toBeInTheDocument()
    })
  })

  it('preserves the draft, labels, and mentions when a post submission fails', async () => {
    createPost.mockRejectedValueOnce(new Error('network'))
    renderBookDiscussionPage()
    await prepareComposerState()

    fireEvent.click(screen.getByRole('button', { name: '전송' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '감상을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.',
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
    openMentionSelector()
    await screen.findByRole('button', { name: '민수 멘션' })
    fireEvent.click(screen.getByRole('button', { name: '민수 멘션' }))
    fireEvent.change(screen.getByLabelText('메시지 입력'), { target: { value: '저도요' } })

    fireEvent.click(screen.getByRole('button', { name: '전송' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '감상을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.',
    )
    expect(screen.getByText('답글 남기기', { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByLabelText('메시지 입력')).toHaveValue('저도요')
    expect(screen.getByRole('button', { name: '민수 멘션 삭제' })).toBeInTheDocument()
  })

  it.each([
    ['outside click', () => fireEvent.pointerDown(document.body)],
    [
      'close button',
      () => fireEvent.click(screen.getByRole('button', { name: '메시지 추가 메뉴 닫기' })),
    ],
    ['Escape', () => fireEvent.keyDown(window, { key: 'Escape' })],
  ])('preserves the active label draft after closing with %s', (_, closeMenu) => {
    renderBookDiscussionPage()
    openPageLabelEditor()
    fireEvent.change(screen.getByLabelText('페이지 번호'), { target: { value: '87' } })

    closeMenu()
    fireEvent.click(screen.getByRole('button', { name: '메시지 추가 메뉴 열기' }))

    expect(screen.getByLabelText('페이지 번호')).toHaveValue('87')
  })

  it('returns to label selection without clearing separate page and chapter drafts', () => {
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

/** 채팅 추가 메뉴에서 멤버 멘션 선택 목록을 연다. */
function openMentionSelector() {
  fireEvent.click(screen.getByRole('button', { name: '메시지 추가 메뉴 열기' }))
  fireEvent.click(screen.getByRole('button', { name: '멤버 멘션' }))
}

/** 본문·페이지 라벨·멤버 멘션을 포함한 작성 중 상태를 만든다. */
async function prepareComposerState() {
  openPageLabelEditor()
  fireEvent.change(screen.getByLabelText('페이지 번호'), { target: { value: '87' } })
  fireEvent.click(screen.getByRole('button', { name: '라벨 추가' }))
  openMentionSelector()
  await screen.findByRole('button', { name: '민수 멘션' })
  fireEvent.click(screen.getByRole('button', { name: '민수 멘션' }))
  fireEvent.change(screen.getByLabelText('메시지 입력'), { target: { value: '함께 읽어 봐요' } })
}

/** 작성 중인 본문·라벨·멘션이 화면에 유지되는지 검증한다. */
function expectComposerState() {
  expect(screen.getByLabelText('메시지 입력')).toHaveValue('함께 읽어 봐요')
  expect(screen.getByText('페이지 87')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '민수 멘션 삭제' })).toBeInTheDocument()
}

function renderBookDiscussionPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/rooms/room-1/books/book-1']}>
        <Routes>
          <Route path="/rooms/:roomId/books/:bookChatId" element={<BookDiscussionPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** 테스트에서 임의 시점에 완료할 비동기 값을 만든다. */
function createDeferredValue<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })

  return { promise, resolve }
}
