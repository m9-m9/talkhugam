import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { VideoArchivePage } from './VideoArchivePage'

const {
  getVideoFilterMembers,
  getVideoPlaybackAuthorization,
  getVideoPosts,
  uploadVideo,
  videoUploadState,
} = vi.hoisted(() => ({
  getVideoFilterMembers: vi.fn().mockResolvedValue([]),
  getVideoPlaybackAuthorization: vi.fn().mockResolvedValue({
    expiresAt: 1_784_269_999,
    playbackId: 'playback-id',
    thumbnailToken: 'thumbnail-token',
    token: 'playback-token',
  }),
  getVideoPosts: vi.fn().mockResolvedValue([]),
  uploadVideo: vi.fn(),
  videoUploadState: { isUploadingVideo: false },
}))

vi.mock('../../entities/video', () => ({
  deleteVideoPost: vi.fn(),
  createMuxThumbnailUrl: () => 'https://image.mux.com/playback-id/thumbnail.webp?token=token',
  filterVideoPosts: (videos: unknown[], filter: { kind: string; memberId?: string | null }) => {
    if (filter.kind === 'all') return videos
    return videos.filter(
      (video) => (video as { authorMemberId: string | null }).authorMemberId === filter.memberId,
    )
  },
  getVideoFilterMembers,
  getVideoPost: vi.fn(),
  getVideoPlaybackAuthorization,
  getVideoPosts,
  videoKeys: {
    byBookChat: (bookChatId: string) => ['video-posts', bookChatId],
    members: (roomId: string) => ['video-filter-members', roomId],
    playback: (postId: string) => ['video-playback', postId],
  },
}))

vi.mock('../../features/video-upload', () => ({
  useVideoUpload: () => ({
    errorMessage: null,
    isUploadingVideo: videoUploadState.isUploadingVideo,
    uploadVideo,
  }),
}))

vi.mock('../../shared/api/supabaseClient', () => ({
  createSupabaseClient: vi.fn(),
}))

describe('VideoArchivePage', () => {
  afterEach(() => {
    cleanup()
    getVideoPosts.mockClear()
    getVideoPosts.mockResolvedValue([])
    getVideoFilterMembers.mockClear()
    getVideoFilterMembers.mockResolvedValue([])
    getVideoPlaybackAuthorization.mockClear()
    uploadVideo.mockClear()
    videoUploadState.isUploadingVideo = false
  })

  it('opens the native video picker from its labeled upload button when videos exist', async () => {
    getVideoPosts.mockResolvedValueOnce([createFailedVideo('video-1', '민규')])
    const inputClick = vi.spyOn(HTMLInputElement.prototype, 'click')
    renderArchivePage()

    fireEvent.click(await screen.findByRole('button', { name: '영상 추가' }))

    expect(inputClick).toHaveBeenCalledOnce()
    inputClick.mockRestore()
  })

  it('opens the native video picker directly from the empty state', async () => {
    const inputClick = vi.spyOn(HTMLInputElement.prototype, 'click')
    renderArchivePage()

    fireEvent.click(await screen.findByRole('button', { name: '첫 영상 올리기' }))

    expect(inputClick).toHaveBeenCalledOnce()
    expect(screen.queryByText('채팅창의 + 버튼에서 첫 영상을 남겨 보세요.')).not.toBeInTheDocument()
    inputClick.mockRestore()
  })

  it('shows a video query error instead of the empty upload state and retries', async () => {
    getVideoPosts.mockRejectedValueOnce(new Error('network'))
    renderArchivePage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '영상 기록을 불러오지 못했어요. 다시 시도해 주세요.',
    )
    expect(screen.queryByRole('button', { name: '첫 영상 올리기' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    await vi.waitFor(() => expect(getVideoPosts).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole('button', { name: '첫 영상 올리기' })).toBeInTheDocument()
  })

  it('keeps the retry action disabled while the failed video query is being requested again', async () => {
    const retryRequest = createDeferredValue<ReturnType<typeof createFailedVideos>>()
    getVideoPosts
      .mockRejectedValueOnce(new Error('network'))
      .mockReturnValueOnce(retryRequest.promise)
    renderArchivePage()

    fireEvent.click(await screen.findByRole('button', { name: '다시 시도' }))

    expect(
      await screen.findByRole('status', { name: '영상을 다시 불러오고 있어요.' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeDisabled()

    retryRequest.resolve([])

    expect(await screen.findByRole('button', { name: '첫 영상 올리기' })).toBeInTheDocument()
  })

  it('keeps saved videos visible when a later video query fails', async () => {
    getVideoPosts.mockRejectedValueOnce(new Error('network'))
    renderArchivePage({ initialVideos: createFailedVideos() })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '영상 기록을 불러오지 못했어요. 다시 시도해 주세요.',
    )
    expect(screen.getByRole('list', { name: '영상 기록' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '민규님의 영상 상태' })).toBeInTheDocument()
  })

  it('sends the selected video to the shared uploader', () => {
    renderArchivePage()
    const file = new File(['video'], 'moment.mp4', { type: 'video/mp4' })

    fireEvent.change(screen.getByLabelText('영상 파일 선택'), { target: { files: [file] } })

    expect(uploadVideo).toHaveBeenCalledWith(file)
  })

  it('uses the book loader while a selected video is uploading', () => {
    videoUploadState.isUploadingVideo = true
    renderArchivePage()

    const status = screen.getByRole('status', { name: '영상을 올리고 있어요…' })
    expect(status.querySelector('.talkhugam-book-loader')).toBeInTheDocument()
  })

  it('does not keep the book loader running after video processing fails', async () => {
    getVideoPosts.mockResolvedValueOnce([
      {
        authorName: '민규',
        body: null,
        createdAt: '2026-07-17T00:00:00.000Z',
        id: 'video-1',
        status: 'failed',
      },
    ])
    renderArchivePage()

    expect(await screen.findByText('처리 실패')).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: '처리 실패' })).not.toBeInTheDocument()
  })

  it('lays out saved videos in a two-column gallery', async () => {
    getVideoPosts.mockResolvedValueOnce([
      createFailedVideo('video-1', '민규'),
      createFailedVideo('video-2', '수진'),
    ])
    renderArchivePage()

    const gallery = await screen.findByRole('list', { name: '영상 기록' })
    expect(gallery).toHaveClass('grid-cols-2')
    expect(gallery).toHaveClass('-mx-4')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('shows only the signed-in member videos when 내 영상 is selected', async () => {
    getVideoFilterMembers.mockResolvedValueOnce([
      { displayName: '민규', id: 'member-1', isCurrentUser: true },
      { displayName: '수진', id: 'member-2', isCurrentUser: false },
    ])
    getVideoPosts.mockResolvedValueOnce([
      createReadyVideo('video-1', 'member-1', '민규'),
      createReadyVideo('video-2', 'member-2', '수진'),
    ])
    renderArchivePage()

    fireEvent.click(await screen.findByRole('button', { name: '내 영상' }))

    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByRole('button', { name: '민규님의 영상 보기' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '수진님의 영상 보기' })).not.toBeInTheDocument()
  })

  it('shows an error and retries when member filters cannot be loaded', async () => {
    getVideoPosts.mockResolvedValueOnce([createFailedVideo('video-1', '민규')])
    getVideoFilterMembers.mockRejectedValueOnce(new Error('network'))
    renderArchivePage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '멤버를 불러오지 못했어요. 다시 시도해 주세요.',
    )
    const retryButton = screen.getByRole('button', { name: '멤버 다시 시도' })
    expect(retryButton).toHaveClass('min-h-11')
    expect(screen.getByRole('button', { name: '멤버 필터: 모든 멤버' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '내 영상' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '전체' })).not.toBeDisabled()

    fireEvent.click(retryButton)

    await vi.waitFor(() => expect(getVideoFilterMembers).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: '멤버 필터: 모든 멤버' })).not.toBeDisabled()
      expect(screen.getByRole('button', { name: '내 영상' })).not.toBeDisabled()
    })
  })

  it('disables only 내 영상 while member filters are loading', async () => {
    getVideoPosts.mockResolvedValueOnce([createFailedVideo('video-1', '민규')])
    getVideoFilterMembers.mockImplementationOnce(() => new Promise(() => undefined))
    renderArchivePage()

    expect(await screen.findByRole('button', { name: '내 영상' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '전체' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: '멤버 필터: 모든 멤버' })).toBeDisabled()
  })

  it('shows an error and retries when member filters fail before any videos exist', async () => {
    getVideoPosts.mockResolvedValueOnce([])
    getVideoFilterMembers.mockRejectedValueOnce(new Error('network'))
    renderArchivePage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '멤버를 불러오지 못했어요. 다시 시도해 주세요.',
    )
    const retryButton = screen.getByRole('button', { name: '멤버 다시 시도' })
    expect(retryButton).toHaveClass('min-h-11')

    fireEvent.click(retryButton)

    await vi.waitFor(() => expect(getVideoFilterMembers).toHaveBeenCalledTimes(2))
  })

  it('keeps the member filter available without an error when the member list is empty', async () => {
    getVideoPosts.mockResolvedValueOnce([createFailedVideo('video-1', '민규')])
    getVideoFilterMembers.mockResolvedValueOnce([])
    renderArchivePage()

    const memberFilterButton = await screen.findByRole('button', {
      name: '멤버 필터: 모든 멤버',
    })
    expect(memberFilterButton).not.toBeDisabled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '멤버 다시 시도' })).not.toBeInTheDocument()
  })

  it('opens a member filter menu and filters the gallery by the chosen member', async () => {
    getVideoFilterMembers.mockResolvedValueOnce([
      { displayName: '민규', id: 'member-1', isCurrentUser: true },
      { displayName: '수진', id: 'member-2', isCurrentUser: false },
    ])
    getVideoPosts.mockResolvedValueOnce([
      createReadyVideo('video-1', 'member-1', '민규'),
      createReadyVideo('video-2', 'member-2', '수진'),
    ])
    renderArchivePage()

    fireEvent.click(await screen.findByRole('button', { name: '멤버 필터: 모든 멤버' }))

    expect(await screen.findByRole('listbox', { name: '멤버 필터' })).toBeInTheDocument()
    expect(screen.getByText('누구의 영상?')).toBeInTheDocument()
    expect(
      within(screen.getByRole('option', { name: '모든 멤버' })).queryByText('모', { exact: true }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '멤버 필터: 모든 멤버' }).closest('.overflow-x-auto'),
    ).toBeNull()
    fireEvent.click(screen.getByRole('option', { name: '수진' }))

    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByRole('button', { name: '수진님의 영상 보기' })).toBeInTheDocument()
  })

  it('dismisses the member filter menu when the user clicks outside it', async () => {
    getVideoFilterMembers.mockResolvedValueOnce([
      { displayName: '민규', id: 'member-1', isCurrentUser: true },
    ])
    getVideoPosts.mockResolvedValueOnce([createReadyVideo('video-1', 'member-1', '민규')])
    renderArchivePage()

    fireEvent.click(await screen.findByRole('button', { name: '멤버 필터: 모든 멤버' }))
    expect(await screen.findByRole('listbox', { name: '멤버 필터' })).toBeInTheDocument()

    fireEvent.pointerDown(document.body)

    expect(screen.queryByRole('listbox', { name: '멤버 필터' })).not.toBeInTheDocument()
  })

  it('dismisses the member filter menu with Escape', async () => {
    getVideoFilterMembers.mockResolvedValueOnce([
      { displayName: '민규', id: 'member-1', isCurrentUser: true },
    ])
    getVideoPosts.mockResolvedValueOnce([createReadyVideo('video-1', 'member-1', '민규')])
    renderArchivePage()

    fireEvent.click(await screen.findByRole('button', { name: '멤버 필터: 모든 멤버' }))
    expect(await screen.findByRole('listbox', { name: '멤버 필터' })).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(screen.queryByRole('listbox', { name: '멤버 필터' })).not.toBeInTheDocument()
  })

  it('opens a ready video from a square gallery thumbnail', async () => {
    getVideoPosts.mockResolvedValueOnce([createReadyVideo('video-1', 'member-1', '민규')])
    renderArchivePage()

    const videoButton = await screen.findByRole('button', { name: '민규님의 영상 보기' })
    expect(videoButton.querySelector('.aspect-square')).toBeInTheDocument()
    fireEvent.click(videoButton)

    expect(screen.getByText('영상 상세 화면')).toBeInTheDocument()
  })
})

/**
 * 입력 없이 오류 또는 처리 실패 상태를 검증할 영상 목록을 생성한다.
 * @returns 민규가 작성한 처리 실패 영상 하나를 반환한다.
 */
function createFailedVideos() {
  return [createFailedVideo('video-1', '민규')]
}

/**
 * 영상 식별자와 작성자 이름을 입력받아 처리 실패 상태의 영상 도메인 데이터를 생성한다.
 * @returns 영상 보관함 목록 테스트에 쓸 처리 실패 영상 데이터를 반환한다.
 */
function createFailedVideo(id: string, authorName: string) {
  return {
    authorMemberId: 'member-1',
    authorName,
    body: null,
    createdAt: '2026-07-17T00:00:00.000Z',
    id,
    status: 'failed' as const,
  }
}

/**
 * 영상 식별자, 작성자 식별자와 이름을 입력받아 재생 가능한 영상 도메인 데이터를 생성한다.
 * @returns 영상 필터 및 재생 테스트에 쓸 준비 완료 영상 데이터를 반환한다.
 */
function createReadyVideo(id: string, authorMemberId: string, authorName: string) {
  return {
    authorMemberId,
    authorName,
    body: null,
    createdAt: '2026-07-17T00:00:00.000Z',
    id,
    status: 'ready' as const,
  }
}

/**
 * 선택적인 초기 영상 데이터를 입력받아 영상 보관함 라우트를 테스트 환경에 렌더링한다.
 * @returns React Testing Library가 제공하는 렌더링 결과를 반환한다.
 */
function renderArchivePage({
  initialVideos,
}: { initialVideos?: ReturnType<typeof createFailedVideos> } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  if (initialVideos) queryClient.setQueryData(['video-posts', 'book-1'], initialVideos)

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/rooms/room-1/books/book-1/videos']}>
        <Routes>
          <Route path="/rooms/:roomId/books/:bookChatId/videos" element={<VideoArchivePage />} />
          <Route
            path="/rooms/:roomId/books/:bookChatId/videos/:videoId"
            element={<p>영상 상세 화면</p>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/**
 * 임의의 제네릭 값을 입력 없이 나중에 완료할 수 있는 Promise를 생성한다.
 * @returns Promise와 해당 Promise를 완료할 resolve 함수를 반환한다.
 */
function createDeferredValue<Value>() {
  let resolvePromise: (value: Value) => void = () => undefined
  const promise = new Promise<Value>((resolve) => {
    resolvePromise = resolve
  })

  return { promise, resolve: resolvePromise }
}
