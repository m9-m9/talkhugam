import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ProfilePage } from './ProfilePage'

const { getMyArchivedBookChats, getMyCompletedBooks, getProfile } = vi.hoisted(() => ({
  getMyArchivedBookChats: vi.fn().mockResolvedValue([
    {
      archivedAt: '2026-07-18T01:00:00+00:00',
      authors: ['기시미 이치로'],
      bookChatId: '00000000-0000-0000-0000-000000000301',
      roomId: '00000000-0000-0000-0000-000000000302',
      thumbnailUrl: null,
      title: '아카이브한 책',
    },
  ]),
  getMyCompletedBooks: vi.fn().mockResolvedValue([
    {
      authors: ['기시미 이치로'],
      bookChatId: '00000000-0000-0000-0000-000000000201',
      completedAt: '2026-07-18T01:00:00+00:00',
      rating: 5,
      review: '다시 읽고 싶은 책이에요.',
      roomId: '00000000-0000-0000-0000-000000000202',
      thumbnailUrl: null,
      title: '미움받을 용기',
    },
  ]),
  getProfile: vi.fn().mockResolvedValue({
    bio: '천천히 읽고 오래 남겨요.',
    displayName: '민규',
    mbti: 'INTP',
  }),
}))

vi.mock('../../entities/book-completion', () => ({
  bookCompletionKeys: { myBooks: (profileId: string) => ['my-completed-books', profileId] },
  getMyCompletedBooks,
}))

vi.mock('../../entities/book-chat', () => ({
  bookChatKeys: { myArchived: (profileId: string) => ['archived-book-chats', profileId] },
  getMyArchivedBookChats,
}))

vi.mock('../../entities/profile', () => ({ getProfile }))

vi.mock('../../features/auth', () => ({
  useAuthenticatedUser: () => ({ id: '00000000-0000-0000-0000-000000000001' }),
}))

vi.mock('../../shared/api/supabaseClient', () => ({
  createSupabaseClient: vi.fn(),
}))

describe('ProfilePage', () => {
  beforeEach(() => {
    getMyArchivedBookChats.mockResolvedValue([
      {
        archivedAt: '2026-07-18T01:00:00+00:00',
        authors: ['기시미 이치로'],
        bookChatId: '00000000-0000-0000-0000-000000000301',
        roomId: '00000000-0000-0000-0000-000000000302',
        thumbnailUrl: null,
        title: '아카이브한 책',
      },
    ])
    getMyCompletedBooks.mockResolvedValue([
      {
        authors: ['기시미 이치로'],
        bookChatId: '00000000-0000-0000-0000-000000000201',
        completedAt: '2026-07-18T01:00:00+00:00',
        rating: 5,
        review: '다시 읽고 싶은 책이에요.',
        roomId: '00000000-0000-0000-0000-000000000202',
        thumbnailUrl: null,
        title: '미움받을 용기',
      },
    ])
    getProfile.mockResolvedValue({
      bio: '천천히 읽고 오래 남겨요.',
      displayName: '민규',
      mbti: 'INTP',
    })
  })

  afterEach(() => {
    cleanup()
    vi.resetAllMocks()
  })

  it('shows the signed-in member completed books between profile and account settings', async () => {
    renderProfilePage()

    expect(await screen.findByRole('heading', { name: '내가 완독한 책' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '미움받을 용기 책 대화로 이동' })).toHaveAttribute(
      'href',
      '/rooms/00000000-0000-0000-0000-000000000202/books/00000000-0000-0000-0000-000000000201',
    )
    expect(screen.getByText('★★★★★')).toBeInTheDocument()
    expect(screen.getByText('다시 읽고 싶은 책이에요.')).toBeInTheDocument()
  })

  it('shows archived book chats in the member reading history', async () => {
    renderProfilePage()

    expect(await screen.findByRole('heading', { name: '보관한 책' })).toBeInTheDocument()
    expect(screen.getByText('아카이브한 책')).toBeInTheDocument()
  })

  it('shows a retry state instead of a loading spinner when the profile lookup fails', async () => {
    getProfile.mockRejectedValueOnce(new Error('network'))
    renderProfilePage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '프로필 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
    )
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument()
    expect(
      screen.queryByRole('status', { name: '내 정보를 불러오고 있어요.' }),
    ).not.toBeInTheDocument()
  })

  it('shows the book loader while retrying a failed profile lookup', async () => {
    const deferredProfile = createDeferredValue<{
      bio: string
      displayName: string
      mbti: string
    }>()
    getProfile
      .mockRejectedValueOnce(new Error('network'))
      .mockReturnValueOnce(deferredProfile.promise)
    renderProfilePage()

    fireEvent.click(await screen.findByRole('button', { name: '다시 시도' }))

    expect(
      await screen.findByRole('status', { name: '내 정보를 다시 불러오고 있어요.' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeDisabled()

    deferredProfile.resolve({
      bio: '천천히 읽고 오래 남겨요.',
      displayName: '민규',
      mbti: 'INTP',
    })

    expect(await screen.findByRole('heading', { name: '민규' })).toBeInTheDocument()
  })

  it('keeps completed books visible when a later lookup fails and offers a retry', async () => {
    getMyCompletedBooks
      .mockResolvedValueOnce([
        {
          authors: ['기시미 이치로'],
          bookChatId: '00000000-0000-0000-0000-000000000201',
          completedAt: '2026-07-18T01:00:00+00:00',
          rating: 5,
          review: '다시 읽고 싶은 책이에요.',
          roomId: '00000000-0000-0000-0000-000000000202',
          thumbnailUrl: null,
          title: '미움받을 용기',
        },
      ])
      .mockRejectedValueOnce(new Error('network'))
    const { queryClient } = renderProfilePage()

    expect(
      await screen.findByRole('link', { name: '미움받을 용기 책 대화로 이동' }),
    ).toBeInTheDocument()
    await queryClient.refetchQueries({ queryKey: ['my-completed-books'] })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '완독한 책을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
    )
    expect(screen.getByRole('link', { name: '미움받을 용기 책 대화로 이동' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument()
  })
})

/** 프로필 페이지에 필요한 라우터와 서버 상태 Provider를 구성해 렌더링한다. */
function renderProfilePage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/profile']}>
        <Routes>
          <Route path="/profile" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )

  return { ...result, queryClient }
}

/** 테스트에서 수동으로 완료 시점을 제어할 비동기 값을 만든다. */
function createDeferredValue<Value>() {
  let resolve: (value: Value) => void = () => undefined
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise
  })

  return { promise, resolve }
}
