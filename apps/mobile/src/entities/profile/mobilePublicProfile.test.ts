import { describe, expect, it, vi } from 'vitest'

import { getMobilePublicProfile } from './mobilePublicProfile'

const profileId = '00000000-0000-4000-8000-000000000002'

describe('getMobilePublicProfile', () => {
  it('uses the public profile RPC rather than reading the private profile table', async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: [{ avatar_path: null, bio: null, display_name: '수진', follower_count: 2, id: profileId, is_following: false }],
        error: null,
      }),
    }

    await expect(getMobilePublicProfile(client as never, profileId)).resolves.toMatchObject({ displayName: '수진' })
    expect(client.rpc).toHaveBeenCalledWith('get_public_profile', { p_profile_id: profileId })
  })
})
