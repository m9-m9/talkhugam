import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BookDiscussionPage } from './BookDiscussionPage'

const { getPosts, getVideoPosts, parsePostForm } = vi.hoisted(() => ({
  getPosts: vi.fn().mockResolvedValue([]),
  getVideoPosts: vi.fn().mockResolvedValue([]),
  parsePostForm: vi.fn(
    ({ body, labels }: { body: string; labels: Array<{ kind: string; value: string }> }) => {
      const normalizedLabels = labels
        .map((label) => ({ ...label, value: label.value.trim() }))
        .filter((label) => label.value.length > 0)
      if (body.trim().length === 0 && normalizedLabels.length === 0) throw new Error('invalid post')
      return { body, labels: normalizedLabels }
    },
  ),
}))

vi.mock('../../entities/post', () => ({
  createPost: vi.fn(),
  createReply: vi.fn(),
  getPosts,
  parsePostForm,
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

    fireEvent.click(screen.getByRole('button', { name: '메시지 추가 메뉴 열기' }))

    const actionMenu = screen.getByText('페이지 라벨').closest('.talkhugam-chat-action-menu')
    expect(actionMenu).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '영상 올리기' })).toBeInTheDocument()
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
})

function openPageLabelEditor() {
  fireEvent.click(screen.getByRole('button', { name: '메시지 추가 메뉴 열기' }))
  fireEvent.click(screen.getByRole('button', { name: '페이지 라벨' }))
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
