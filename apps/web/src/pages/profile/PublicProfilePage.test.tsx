import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { PublicProfilePage } from './PublicProfilePage'

const profileId = '00000000-0000-4000-8000-000000000002'
const { followPublicProfile, getPublicProfile, listPublicProfileFollowers, unfollowPublicProfile } = vi.hoisted(() => ({
  followPublicProfile: vi.fn(), getPublicProfile: vi.fn(), listPublicProfileFollowers: vi.fn(), unfollowPublicProfile: vi.fn(),
}))
vi.mock('../../entities/profile', () => ({ followPublicProfile, getPublicProfile, listPublicProfileFollowers, unfollowPublicProfile }))
vi.mock('../../shared/api/supabaseClient', () => ({ createSupabaseClient: vi.fn(() => ({})) }))

describe('PublicProfilePage', () => {
  it('shows public fields and toggles a follow relationship', async () => {
    getPublicProfile.mockResolvedValue({ avatarPath: null, bio: '문장을 모읍니다.', displayName: '수진', followerCount: 2, id: profileId, isFollowing: false })
    listPublicProfileFollowers.mockResolvedValue([])
    followPublicProfile.mockResolvedValue(true)
    renderPage()

    expect(await screen.findByRole('heading', { name: '수진' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '수진 팔로우' }))
    expect(await screen.findByRole('button', { name: '수진 언팔로우' })).toBeInTheDocument()
  })
})

/** 공개 프로필 경로와 격리된 QueryClient로 화면을 렌더링한다. */
function renderPage(): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false }, mutations: { gcTime: Infinity, retry: false } } })
  render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[`/profiles/${profileId}`]}><Routes><Route element={<PublicProfilePage />} path="/profiles/:profileId" /></Routes></MemoryRouter></QueryClientProvider>)
}
