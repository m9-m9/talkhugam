import { describe, expect, it, vi } from 'vitest'

import { followPublicProfile, getPublicProfile, listPublicProfileFollowers, unfollowPublicProfile } from './publicProfile'

const profileId = '00000000-0000-4000-8000-000000000002'

/** 공개 프로필 RPC만 호출하는 Supabase 테스트 경계를 생성한다. */
function createClient(response: unknown = { data: [], error: null }) {
  return { rpc: vi.fn().mockResolvedValue(response) }
}

describe('public profile repository', () => {
  it('maps the get_public_profile RPC response without querying private profiles', async () => {
    const client = createClient({
      data: [{ avatar_path: null, bio: '소개', display_name: '수진', follower_count: 2, id: profileId, is_following: false }],
      error: null,
    })

    await expect(getPublicProfile(client as never, profileId)).resolves.toMatchObject({ displayName: '수진', followerCount: 2 })
    expect(client.rpc).toHaveBeenCalledWith('get_public_profile', { p_profile_id: profileId })
  })

  it('uses the limited follower RPC and dedicated follow mutations', async () => {
    const client = createClient()
    client.rpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: [], error: null })

    await expect(followPublicProfile(client as never, profileId)).resolves.toBe(true)
    await expect(unfollowPublicProfile(client as never, profileId)).resolves.toBe(true)
    await listPublicProfileFollowers(client as never, profileId)

    expect(client.rpc).toHaveBeenNthCalledWith(1, 'follow_profile', { p_followed_profile_id: profileId })
    expect(client.rpc).toHaveBeenNthCalledWith(2, 'unfollow_profile', { p_followed_profile_id: profileId })
    expect(client.rpc).toHaveBeenNthCalledWith(3, 'list_public_profile_followers', { p_limit: 20, p_profile_id: profileId })
  })
})
