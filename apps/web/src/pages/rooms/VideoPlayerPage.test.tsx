import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { VideoPlayerPage } from './VideoPlayerPage'

const { deleteVideoPost, getVideoDeletePermission, getVideoPlaybackAuthorization, getVideoPost } =
  vi.hoisted(() => ({
    deleteVideoPost: vi.fn().mockResolvedValue(undefined),
    getVideoDeletePermission: vi.fn().mockResolvedValue({ canDelete: true }),
    getVideoPlaybackAuthorization: vi.fn().mockResolvedValue({
      expiresAt: 1_784_269_999,
      playbackId: 'playback-id',
      thumbnailToken: 'thumbnail-token',
      token: 'playback-token',
    }),
    getVideoPost: vi.fn().mockResolvedValue({
      authorMemberId: 'member-1',
      authorName: '민규',
      body: null,
      createdAt: '2026-07-17T00:00:00.000Z',
      id: 'video-1',
      status: 'ready',
    }),
  }))

vi.mock('@mux/mux-player-react', () => ({
  default: ({ onError, playbackId }: { onError?: () => void; playbackId: string }) => (
    <button
      data-playback-id={playbackId}
      data-testid="mux-player"
      onClick={onError}
      type="button"
    />
  ),
}))

vi.mock('../../entities/video', () => ({
  deleteVideoPost,
  getVideoDeletePermission,
  getVideoPlaybackAuthorization,
  getVideoPost,
  videoKeys: {
    byBookChat: (bookChatId: string) => ['video-posts', bookChatId],
    byPost: (postId: string) => ['video-post', postId],
    deletePermission: (roomId: string, authorMemberId: string | null) => [
      'video-delete-permission',
      roomId,
      authorMemberId,
    ],
    playback: (postId: string) => ['video-playback', postId],
  },
}))

vi.mock('../../shared/api/supabaseClient', () => ({
  createSupabaseClient: vi.fn(),
}))

describe('VideoPlayerPage', () => {
  afterEach(() => {
    cleanup()
    getVideoPost.mockClear()
    getVideoPlaybackAuthorization.mockClear()
    getVideoDeletePermission.mockClear()
    deleteVideoPost.mockClear()
  })

  it('plays the selected video in an immersive edge-to-edge viewer', async () => {
    renderPlayerPage()

    expect(await screen.findByRole('heading', { name: '영상 보기' })).toBeInTheDocument()
    expect(await screen.findByTestId('mux-player')).toHaveAttribute(
      'data-playback-id',
      'playback-id',
    )
    expect(screen.getByRole('main')).toHaveClass('px-0')
  })

  it('returns to the video archive from its back button', async () => {
    renderPlayerPage()

    fireEvent.click(await screen.findByRole('button', { name: '영상 기록으로 돌아가기' }))

    expect(screen.getByText('영상 기록 화면')).toBeInTheDocument()
  })

  it('shows an archive return CTA when the selected video no longer exists', async () => {
    getVideoPost.mockResolvedValueOnce(null)
    renderPlayerPage()

    expect(await screen.findByText('이 영상을 찾을 수 없어요.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '영상 기록으로 가기' }))

    expect(screen.getByText('영상 기록 화면')).toBeInTheDocument()
  })

  it('does not keep a non-ready video in a loading state', async () => {
    getVideoPost.mockResolvedValueOnce({
      authorMemberId: 'member-1',
      authorName: '민규',
      body: null,
      createdAt: '2026-07-17T00:00:00.000Z',
      id: 'video-1',
      status: 'failed',
    })
    renderPlayerPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('이 영상은 아직 재생할 수 없어요.')
    expect(
      screen.queryByRole('status', { name: '영상을 준비하고 있어요.' }),
    ).not.toBeInTheDocument()
    expect(getVideoPlaybackAuthorization).not.toHaveBeenCalled()
  })

  it('hides the delete control from a member who is neither the author nor room owner', async () => {
    getVideoDeletePermission.mockResolvedValueOnce({ canDelete: false })
    renderPlayerPage()

    expect(await screen.findByTestId('mux-player')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument()
  })

  it('checks deletion permission with the current room and video author identifiers', async () => {
    renderPlayerPage()

    await screen.findByTestId('mux-player')

    expect(getVideoDeletePermission).toHaveBeenCalledWith(undefined, 'room-1', 'member-1')
  })

  it('keeps the delete control hidden when permission lookup fails', async () => {
    getVideoDeletePermission.mockRejectedValueOnce(new Error('permission unavailable'))
    renderPlayerPage()

    expect(await screen.findByTestId('mux-player')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument()
  })

  it('requires confirmation before deleting an authorized video', async () => {
    renderPlayerPage()

    fireEvent.click(await screen.findByRole('button', { name: '삭제' }))

    expect(screen.getByRole('dialog', { name: '영상 삭제' })).toBeInTheDocument()
    expect(deleteVideoPost).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '영상 삭제하기' }))

    await vi.waitFor(() => expect(deleteVideoPost).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('영상 기록 화면')).toBeInTheDocument()
  })

  it('dismisses the video deletion dialog by Escape or its backdrop without deleting', async () => {
    renderPlayerPage()

    const trigger = await screen.findByRole('button', { name: '삭제' })
    fireEvent.click(trigger)
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(screen.queryByRole('dialog', { name: '영상 삭제' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()

    fireEvent.click(trigger)
    const dialog = screen.getByRole('dialog', { name: '영상 삭제' })
    const backdrop = dialog.parentElement
    if (!backdrop) throw new Error('영상 삭제 확인창의 배경을 찾지 못했습니다.')
    fireEvent.mouseDown(backdrop)

    expect(screen.queryByRole('dialog', { name: '영상 삭제' })).not.toBeInTheDocument()
    expect(deleteVideoPost).not.toHaveBeenCalled()
  })

  it('shows a retryable error when video deletion fails', async () => {
    deleteVideoPost.mockRejectedValueOnce(new Error('delete failed'))
    renderPlayerPage()

    fireEvent.click(await screen.findByRole('button', { name: '삭제' }))
    fireEvent.click(await screen.findByRole('button', { name: '영상 삭제하기' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '영상을 삭제하지 못했어요. 다시 시도해 주세요.',
    )

    fireEvent.click(screen.getByRole('button', { name: '삭제 다시 시도' }))

    await vi.waitFor(() => expect(deleteVideoPost).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('영상 기록 화면')).toBeInTheDocument()
  })

  it('explains a video data lookup failure separately and retries that lookup', async () => {
    getVideoPost.mockRejectedValueOnce(new Error('network'))
    renderPlayerPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '영상을 불러오지 못했어요. 다시 시도해 주세요.',
    )
    expect(
      screen.queryByText('재생 정보를 불러오지 못했어요. 다시 시도해 주세요.'),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    await vi.waitFor(() => expect(getVideoPost).toHaveBeenCalledTimes(2))
    expect(await screen.findByTestId('mux-player')).toBeInTheDocument()
  })

  it('explains a playback token failure separately and retries that authorization', async () => {
    getVideoPlaybackAuthorization.mockRejectedValueOnce(new Error('token'))
    renderPlayerPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '재생 정보를 불러오지 못했어요. 다시 시도해 주세요.',
    )
    expect(
      screen.queryByText('영상을 불러오지 못했어요. 다시 시도해 주세요.'),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    await vi.waitFor(() => expect(getVideoPlaybackAuthorization).toHaveBeenCalledTimes(2))
    expect(await screen.findByTestId('mux-player')).toBeInTheDocument()
  })

  it('explains a Mux media playback failure separately and retries its authorization', async () => {
    renderPlayerPage()

    fireEvent.click(await screen.findByTestId('mux-player'))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '영상을 재생하지 못했어요. 다시 시도해 주세요.',
    )
    fireEvent.click(screen.getByRole('button', { name: '재생 다시 시도' }))

    await vi.waitFor(() => expect(getVideoPlaybackAuthorization).toHaveBeenCalledTimes(2))
    expect(await screen.findByTestId('mux-player')).toBeInTheDocument()
  })

  it('keeps a playback retry visible with a book loader and blocks duplicate clicks', async () => {
    const authorization = createDeferredValue<{
      expiresAt: number
      playbackId: string
      thumbnailToken: string
      token: string
    }>()
    getVideoPlaybackAuthorization
      .mockRejectedValueOnce(new Error('token'))
      .mockImplementationOnce(() => authorization.promise)
    renderPlayerPage()

    const retryButton = await screen.findByRole('button', { name: '다시 시도' })
    fireEvent.click(retryButton)

    expect(retryButton).toBeDisabled()
    expect(
      screen.getByRole('status', { name: '재생 정보를 다시 불러오고 있어요.' }),
    ).toBeInTheDocument()

    authorization.resolve({
      expiresAt: 1_784_269_999,
      playbackId: 'playback-id',
      thumbnailToken: 'thumbnail-token',
      token: 'playback-token',
    })

    expect(await screen.findByTestId('mux-player')).toBeInTheDocument()
  })
})

/** 영상 재생 라우트와 QueryClient를 포함한 테스트 화면을 렌더링한다. */
function renderPlayerPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/rooms/room-1/books/book-1/videos/video-1']}>
        <Routes>
          <Route
            path="/rooms/:roomId/books/:bookChatId/videos/:videoId"
            element={<VideoPlayerPage />}
          />
          <Route path="/rooms/:roomId/books/:bookChatId/videos" element={<p>영상 기록 화면</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** 비동기 작업의 완료 시점을 테스트 코드에서 직접 제어할 Promise를 만든다. */
function createDeferredValue<T>() {
  let resolvePromise: (value: T) => void = () => undefined
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve
  })
  return { promise, resolve: resolvePromise }
}
