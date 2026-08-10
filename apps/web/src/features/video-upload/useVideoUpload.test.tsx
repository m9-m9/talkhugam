import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useVideoUpload } from './useVideoUpload'

const { createVideoUpload, getVideoDuration, uploadVideoFile } = vi.hoisted(() => ({
  createVideoUpload: vi.fn(),
  getVideoDuration: vi.fn(),
  uploadVideoFile: vi.fn(),
}))

vi.mock('../../entities/video', () => ({
  createVideoUpload,
  getVideoDuration,
  getVideoUploadErrorMessage: () => '업로드에 실패했어요.',
  uploadVideoFile,
  validateVideoDuration: () => true,
  videoKeys: { byBookChat: (bookChatId: string) => ['video-posts', bookChatId] },
}))

vi.mock('../../shared/api/supabaseClient', () => ({
  createSupabaseClient: vi.fn(),
}))

vi.mock('../../entities/reading-room', () => ({
  readingRoomKeys: { all: ['reading-rooms'] },
}))

describe('useVideoUpload', () => {
  afterEach(() => {
    cleanup()
    createVideoUpload.mockReset()
    getVideoDuration.mockReset()
    uploadVideoFile.mockReset()
  })

  it('refreshes the shared video cache before and after a successful upload', async () => {
    const file = new File(['video'], 'moment.mp4', { type: 'video/mp4' })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
    createVideoUpload.mockResolvedValue({
      postId: '4b7227b2-5350-4a61-9114-b2d0c915fd1b',
      uploadUrl: 'https://upload.example.com/video',
    })
    getVideoDuration.mockResolvedValue(10)
    uploadVideoFile.mockResolvedValue(undefined)

    render(
      <QueryClientProvider client={queryClient}>
        <VideoUploadTestButton bookChatId="d4f20c14-2b75-4278-8e96-d1f8e73d7b37" file={file} />
      </QueryClientProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: '올리기' }))

    await waitFor(() => expect(uploadVideoFile).toHaveBeenCalledOnce())
    expect(invalidateQueries).toHaveBeenCalledTimes(3)
    expect(invalidateQueries).toHaveBeenNthCalledWith(1, {
      queryKey: ['video-posts', 'd4f20c14-2b75-4278-8e96-d1f8e73d7b37'],
    })
    expect(invalidateQueries).toHaveBeenNthCalledWith(2, { queryKey: ['reading-rooms'] })
    expect(invalidateQueries).toHaveBeenNthCalledWith(3, {
      queryKey: ['video-posts', 'd4f20c14-2b75-4278-8e96-d1f8e73d7b37'],
    })
  })

  it('sends the bookmark sentence as a video caption when provided', async () => {
    const file = new File(['video'], 'bookmark.mp4', { type: 'video/mp4' })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    createVideoUpload.mockResolvedValue({
      postId: '4b7227b2-5350-4a61-9114-b2d0c915fd1b',
      uploadUrl: 'https://upload.example.com/video',
    })
    getVideoDuration.mockResolvedValue(10)
    uploadVideoFile.mockResolvedValue(undefined)

    render(
      <QueryClientProvider client={queryClient}>
        <VideoUploadTestButton
          bookChatId="d4f20c14-2b75-4278-8e96-d1f8e73d7b37"
          caption="희미한 빛도 오래 바라보면 방향이 된다."
          file={file}
        />
      </QueryClientProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: '올리기' }))

    await waitFor(() => expect(uploadVideoFile).toHaveBeenCalledOnce())
    expect(createVideoUpload).toHaveBeenCalledWith(
      undefined,
      'd4f20c14-2b75-4278-8e96-d1f8e73d7b37',
      '희미한 빛도 오래 바라보면 방향이 된다.',
    )
  })
})

function VideoUploadTestButton({
  bookChatId,
  caption,
  file,
}: {
  bookChatId: string
  caption?: string
  file: File
}) {
  const { uploadVideo } = useVideoUpload(bookChatId)
  return (
    <button onClick={() => void uploadVideo(file, caption)} type="button">
      올리기
    </button>
  )
}
