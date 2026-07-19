import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { MemberProfilePage } from './MemberProfilePage'

const { getProfile, getProfileAvatarUrl, getRoomManagement } = vi.hoisted(() => ({
  getProfile: vi.fn().mockResolvedValue({
    bio: '좋은 문장을 오래 붙잡아 두는 편이에요.',
    displayName: '수진',
    mbti: 'INFJ',
  }),
  getProfileAvatarUrl: vi.fn().mockResolvedValue(null),
  getRoomManagement: vi.fn().mockResolvedValue({
    members: [
      {
        avatarPath: null,
        displayName: '수진',
        id: '20000000-0000-4000-8000-000000000001',
        isCurrentUser: false,
        joinedAt: '2026-07-18T00:00:00.000+00:00',
        profileId: '00000000-0000-4000-8000-000000000002',
        role: 'member',
      },
    ],
  }),
}))

vi.mock('../../entities/profile', () => ({ getProfile, getProfileAvatarUrl }))
vi.mock('../../entities/room-management', () => ({
  getRoomManagement,
  roomManagementKeys: { detail: (roomId: string) => ['room-management', roomId] },
}))
vi.mock('../../features/auth', () => ({
  useAuthenticatedUser: () => ({ id: '00000000-0000-4000-8000-000000000001' }),
}))
vi.mock('../../shared/api/supabaseClient', () => ({ createSupabaseClient: vi.fn() }))

describe('MemberProfilePage', () => {
  it('shows only the selected active room member profile', async () => {
    renderMemberProfilePage()

    expect(await screen.findByRole('heading', { name: '수진' })).toBeInTheDocument()
    expect(screen.getByText('좋은 문장을 오래 붙잡아 두는 편이에요.')).toBeInTheDocument()
    expect(screen.getByText('INFJ')).toBeInTheDocument()
  })

  it('renders a shared member photo through a signed URL', async () => {
    getProfile.mockResolvedValueOnce({
      avatarPath: '00000000-0000-4000-8000-000000000002/avatar',
      bio: '좋은 문장을 오래 붙잡아 두는 편이에요.',
      displayName: '수진',
      mbti: 'INFJ',
      updatedAt: '2026-07-19T00:00:00.000+00:00',
    })
    getProfileAvatarUrl.mockResolvedValueOnce('https://example.test/member-avatar')

    renderMemberProfilePage()

    expect(await screen.findByRole('img', { name: '수진 프로필 사진' })).toHaveAttribute(
      'src',
      'https://example.test/member-avatar',
    )
  })
})

/** 멤버 프로필 경로와 서버 상태 Provider를 갖춘 화면을 렌더링한다. */
function renderMemberProfilePage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={[
          '/rooms/10000000-0000-4000-8000-000000000001/members/00000000-0000-4000-8000-000000000002',
        ]}
      >
        <Routes>
          <Route element={<MemberProfilePage />} path="/rooms/:roomId/members/:profileId" />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
