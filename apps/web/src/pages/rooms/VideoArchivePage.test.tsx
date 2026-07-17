import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { VideoArchivePage } from './VideoArchivePage'

const { getVideoPosts, uploadVideo } = vi.hoisted(() => ({
  getVideoPosts: vi.fn().mockResolvedValue([]),
  uploadVideo: vi.fn(),
}))

vi.mock('../../entities/video', () => ({
  deleteVideoPost: vi.fn(),
  getVideoPlaybackAuthorization: vi.fn(),
  getVideoPosts,
  videoKeys: { byBookChat: (bookChatId: string) => ['video-posts', bookChatId] },
}))

vi.mock('../../features/video-upload', () => ({
  useVideoUpload: () => ({ errorMessage: null, isUploadingVideo: false, uploadVideo }),
}))

vi.mock('../../shared/api/supabaseClient', () => ({
  createSupabaseClient: vi.fn(),
}))

describe('VideoArchivePage', () => {
  afterEach(() => {
    cleanup()
    getVideoPosts.mockClear()
    uploadVideo.mockClear()
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
