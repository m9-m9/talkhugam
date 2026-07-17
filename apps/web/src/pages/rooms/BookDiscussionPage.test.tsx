import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BookDiscussionPage } from './BookDiscussionPage'

const { getPosts, getVideoPosts } = vi.hoisted(() => ({
  getPosts: vi.fn().mockResolvedValue([]),
  getVideoPosts: vi.fn().mockResolvedValue([]),
}))

vi.mock('../../entities/post', () => ({
  createPost: vi.fn(),
  createReply: vi.fn(),
  getPosts,
  parsePostForm: vi.fn(),
  postKeys: { byBookChat: (bookChatId: string) => ['posts', bookChatId] },
  shouldSubmitMessage: () => false,
}))

vi.mock('../../entities/video', () => ({
  getVideoPlaybackAuthorization: vi.fn(),
  getVideoPosts,
  videoKeys: { byBookChat: (bookChatId: string) => ['video-posts', bookChatId] },
}))

vi.mock('../../entities/reading-room', () => ({
  readingRoomKeys: { all: ['reading-rooms'] },
}))

vi.mock('../../features/video-upload', () => ({
  useVideoUpload: () => ({ errorMessage: null, isUploadingVideo: false, uploadVideo: vi.fn() }),
}))

vi.mock('../../shared/api/supabaseClient', () => ({
  createSupabaseClient: vi.fn(),
}))

describe('BookDiscussionPage', () => {
  afterEach(cleanup)

  it('opens the message actions as a speech bubble above the composer', () => {
    renderBookDiscussionPage()

    fireEvent.click(screen.getByRole('button', { name: '메시지 추가 메뉴' }))

    const actionMenu = screen.getByText('페이지 라벨').closest('.talkhugam-chat-action-menu')
    expect(actionMenu).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '영상 올리기' })).toBeInTheDocument()
  })
})

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
