import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ProfilePage } from './ProfilePage'

const { getMyCompletedBooks, getProfile } = vi.hoisted(() => ({
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

vi.mock('../../entities/profile', () => ({ getProfile }))

vi.mock('../../features/auth', () => ({
  useAuthenticatedUser: () => ({ id: '00000000-0000-0000-0000-000000000001' }),
}))

vi.mock('../../shared/api/supabaseClient', () => ({
  createSupabaseClient: vi.fn(),
}))

describe('ProfilePage', () => {
  afterEach(() => cleanup())

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
})

/** 프로필 페이지에 필요한 라우터와 서버 상태 Provider를 구성해 렌더링한다. */
function renderProfilePage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/profile']}>
        <Routes>
          <Route path="/profile" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
