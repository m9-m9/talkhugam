import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { VideoPlayerPage } from './VideoPlayerPage'

const { getVideoPlaybackAuthorization, getVideoPost } = vi.hoisted(() => ({
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
  default: ({ playbackId }: { playbackId: string }) => (
    <div data-playback-id={playbackId} data-testid="mux-player" />
  ),
}))

vi.mock('../../entities/video', () => ({
  getVideoPlaybackAuthorization,
  getVideoPost,
  videoKeys: {
    byPost: (postId: string) => ['video-post', postId],
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
})

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
