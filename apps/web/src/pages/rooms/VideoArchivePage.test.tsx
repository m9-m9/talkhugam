import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { VideoArchivePage } from './VideoArchivePage'

const { uploadVideo, videoUploadState } = vi.hoisted(() => ({
  uploadVideo: vi.fn(),
  videoUploadState: { errorMessage: null as string | null, isUploadingVideo: false },
}))

vi.mock('../../features/video-upload', () => ({
  useVideoUpload: () => ({
    errorMessage: videoUploadState.errorMessage,
    isUploadingVideo: videoUploadState.isUploadingVideo,
    uploadVideo,
  }),
}))

describe('VideoArchivePage', () => {
  afterEach(() => {
    cleanup()
    uploadVideo.mockClear()
    videoUploadState.errorMessage = null
    videoUploadState.isUploadingVideo = false
  })

  it('renders a SEED action-selection composer instead of the old archive UI', () => {
    renderArchivePage()

    expect(screen.getByRole('heading', { name: '책갈피를 어떻게 남길까요?' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '촬영해서 남기기 지금 장면을 바로 찍어요' }),
    ).toHaveClass('seed-action-button')
    expect(
      screen.getByRole('button', { name: '갤러리에서 올리기 이미 찍은 영상을 붙여요' }),
    ).toHaveClass('seed-action-button')
    expect(screen.getByLabelText('마음에 든 문장')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '전체' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '내 영상' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '멤버 필터: 모든 멤버' })).not.toBeInTheDocument()
    expect(screen.queryByRole('list', { name: '책갈피' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '책갈피 남기기' })).not.toBeInTheDocument()
  })

  it('opens the camera picker from the primary camera action', () => {
    const inputClick = vi.spyOn(HTMLInputElement.prototype, 'click')
    renderArchivePage()

    fireEvent.click(screen.getByRole('button', { name: '촬영해서 남기기 지금 장면을 바로 찍어요' }))

    expect(inputClick).toHaveBeenCalledOnce()
    expect(screen.getByLabelText('촬영 영상 선택')).toHaveAttribute('capture', 'environment')
    inputClick.mockRestore()
  })

  it('opens the upload picker from the secondary gallery action', () => {
    const inputClick = vi.spyOn(HTMLInputElement.prototype, 'click')
    renderArchivePage()

    fireEvent.click(
      screen.getByRole('button', { name: '갤러리에서 올리기 이미 찍은 영상을 붙여요' }),
    )

    expect(inputClick).toHaveBeenCalledOnce()
    expect(screen.getByLabelText('업로드 영상 선택')).not.toHaveAttribute('capture')
    inputClick.mockRestore()
  })

  it('sends the selected camera video with the bookmark sentence to the shared uploader', () => {
    renderArchivePage()
    const file = new File(['video'], 'moment.mp4', { type: 'video/mp4' })

    fireEvent.change(screen.getByLabelText('마음에 든 문장'), {
      target: { value: '희미한 빛도 오래 바라보면 방향이 된다.' },
    })
    fireEvent.change(screen.getByLabelText('촬영 영상 선택'), { target: { files: [file] } })

    expect(uploadVideo).toHaveBeenCalledWith(file, '희미한 빛도 오래 바라보면 방향이 된다.')
  })

  it('sends the selected upload video without a bookmark sentence to the shared uploader', () => {
    renderArchivePage()
    const file = new File(['video'], 'moment.mp4', { type: 'video/mp4' })

    fireEvent.change(screen.getByLabelText('업로드 영상 선택'), { target: { files: [file] } })

    expect(uploadVideo).toHaveBeenCalledWith(file, undefined)
  })

  it('uses the book loader while a selected video is uploading', () => {
    videoUploadState.isUploadingVideo = true
    renderArchivePage()

    const status = screen.getByRole('status', { name: '책갈피 영상을 올리고 있어요…' })
    expect(status.querySelector('.talkhugam-book-loader')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '촬영해서 남기기 지금 장면을 바로 찍어요' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: '갤러리에서 올리기 이미 찍은 영상을 붙여요' }),
    ).toBeDisabled()
  })

  it('shows the uploader error without replacing the action choices', () => {
    videoUploadState.errorMessage = '영상 업로드를 시작하지 못했어요. 잠시 후 다시 시도해 주세요.'
    renderArchivePage()

    expect(screen.getByRole('alert')).toHaveTextContent(
      '영상 업로드를 시작하지 못했어요. 잠시 후 다시 시도해 주세요.',
    )
    expect(
      screen.getByRole('button', { name: '촬영해서 남기기 지금 장면을 바로 찍어요' }),
    ).toBeInTheDocument()
  })
})

/**
 * 영상 작성 라우트를 테스트 환경에 렌더링한다.
 * @returns React Testing Library가 제공하는 렌더링 결과를 반환한다.
 */
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
