import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { VideoArchivePage } from './VideoArchivePage'

const { getVideoPosts, uploadVideo, videoUploadState } = vi.hoisted(() => ({
  getVideoPosts: vi.fn().mockResolvedValue([]),
  uploadVideo: vi.fn(),
  videoUploadState: { isUploadingVideo: false },
}))

vi.mock('../../entities/video', () => ({
  deleteVideoPost: vi.fn(),
  getVideoPlaybackAuthorization: vi.fn(),
  getVideoPosts,
  videoKeys: { byBookChat: (bookChatId: string) => ['video-posts', bookChatId] },
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
    uploadVideo.mockClear()
    videoUploadState.isUploadingVideo = false
  })

  it('opens the native video picker from its round upload button', () => {
    const inputClick = vi.spyOn(HTMLInputElement.prototype, 'click')
    renderArchivePage()

    fireEvent.click(screen.getByRole('button', { name: '영상 올리기' }))

    expect(inputClick).toHaveBeenCalledOnce()
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

    expect(await screen.findByText('영상 처리에 실패했어요.')).toBeInTheDocument()
    expect(
      screen.queryByRole('status', { name: '영상 처리에 실패했어요.' }),
    ).not.toBeInTheDocument()
  })
})

function renderArchivePage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/rooms/room-1/books/book-1/videos']}>
        <Routes>
          <Route path="/rooms/:roomId/books/:bookChatId/videos" element={<VideoArchivePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
