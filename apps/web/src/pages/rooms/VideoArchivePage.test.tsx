import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { VideoArchivePage } from './VideoArchivePage'

vi.mock('@mux/mux-player-react', () => ({
  default: () => <div data-testid="mux-player" />,
}))

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

function renderArchivePage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
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
