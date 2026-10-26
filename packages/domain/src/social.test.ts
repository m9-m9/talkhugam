import { describe, expect, it } from 'vitest'

import { publicProfileKeys, publicProfileSchema } from './social'

describe('publicProfileSchema', () => {
  it('accepts only the public profile contract returned by the social RPC', () => {
    expect(
      publicProfileSchema.parse({
        avatar_path: '00000000-0000-4000-8000-000000000002/avatar',
        bio: '문장을 모읍니다.',
        display_name: '수진',
        follower_count: 3,
        id: '00000000-0000-4000-8000-000000000002',
        is_following: false,
      }),
    ).toMatchObject({ display_name: '수진', follower_count: 3 })
  })
})

describe('publicProfileKeys', () => {
  it('separates profile and follower queries by profile id', () => {
    expect(publicProfileKeys.detail('00000000-0000-4000-8000-000000000002')).toEqual([
      'public-profile',
      '00000000-0000-4000-8000-000000000002',
    ])
    expect(publicProfileKeys.followers('00000000-0000-4000-8000-000000000002')).toEqual([
      'public-profile',
      '00000000-0000-4000-8000-000000000002',
      'followers',
    ])
  })
})
