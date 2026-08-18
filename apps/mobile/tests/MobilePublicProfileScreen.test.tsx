import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { describe, expect, it, jest } from '@jest/globals'

import { MobilePublicProfileScreen } from '../src/features/profile/MobilePublicProfileScreen'

jest.mock('../src/entities/profile/mobilePublicProfile', () => ({
  followMobilePublicProfile: jest.fn(), getMobilePublicProfile: jest.fn(), getMobilePublicProfileFollowers: jest.fn(), unfollowMobilePublicProfile: jest.fn(),
}))
jest.mock('../src/entities/community', () => ({ reportMobileCommunityTarget: jest.fn() }))
jest.mock('../src/shared/api/mobileSupabaseClient', () => ({ createMobileSupabaseClient: jest.fn(() => ({})) }))
import { followMobilePublicProfile, getMobilePublicProfile, getMobilePublicProfileFollowers } from '../src/entities/profile/mobilePublicProfile'
import { reportMobileCommunityTarget } from '../src/entities/community'

const getProfile = jest.mocked(getMobilePublicProfile)
const getFollowers = jest.mocked(getMobilePublicProfileFollowers)
const follow = jest.mocked(followMobilePublicProfile)
const reportTarget = jest.mocked(reportMobileCommunityTarget)
const profileId = '00000000-0000-4000-8000-000000000002'

/** 공개 프로필 서버 상태를 격리해 화면을 렌더링한다. */
function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false }, mutations: { gcTime: Infinity, retry: false } } })
  render(<MobilePublicProfileScreen onBack={jest.fn()} profileId={profileId} />, { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> })
}

describe('MobilePublicProfileScreen', () => {
  it('renders public information and follows the profile', async () => {
    getProfile.mockResolvedValue({ avatarPath: null, bio: '문장을 모읍니다.', displayName: '수진', followerCount: 2, id: profileId, isFollowing: false })
    getFollowers.mockResolvedValue([])
    follow.mockResolvedValue(true)
    renderScreen()

    expect(await screen.findByRole('header', { name: '수진' })).toBeVisible()
    fireEvent.press(screen.getByRole('button', { name: '수진 팔로우' }))
    await waitFor(() => expect(follow).toHaveBeenCalledWith(expect.anything(), profileId))
    expect(screen.getByRole('button', { name: '수진 언팔로우' })).toBeVisible()
  })

  it('reports the public profile without requesting private profile data', async () => {
    getProfile.mockResolvedValue({ avatarPath: null, bio: '문장을 모읍니다.', displayName: '수진', followerCount: 2, id: profileId, isFollowing: false })
    getFollowers.mockResolvedValue([])
    reportTarget.mockResolvedValue('00000000-0000-4000-8000-000000000003')
    renderScreen()

    fireEvent.press(await screen.findByRole('button', { name: '수진 프로필 신고' }))

    await waitFor(() => expect(reportTarget).toHaveBeenCalledWith(expect.anything(), 'profile', profileId, '운영자 확인이 필요해요'))
    expect(screen.getByRole('alert', { name: '프로필 신고를 접수했어요.' })).toBeVisible()
  })
})
