import { z } from 'zod'

export const publicProfileSchema = z.object({
  avatar_path: z.string().nullable(),
  bio: z.string().nullable(),
  display_name: z.string().trim().min(1).max(30),
  follower_count: z.coerce.number().int().nonnegative(),
  id: z.string().uuid(),
  is_following: z.boolean(),
})

export type PublicProfile = {
  avatarPath: string | null
  bio: string | null
  displayName: string
  followerCount: number
  id: string
  isFollowing: boolean
}

/** 공개 프로필 RPC 행을 화면과 저장소에서 안전하게 사용할 도메인 모델로 변환한다. */
export function mapPublicProfile(input: unknown): PublicProfile {
  const profile = publicProfileSchema.parse(input)
  return {
    avatarPath: profile.avatar_path,
    bio: profile.bio,
    displayName: profile.display_name,
    followerCount: profile.follower_count,
    id: profile.id,
    isFollowing: profile.is_following,
  }
}

export const publicProfileKeys = {
  detail: (profileId: string) => ['public-profile', profileId] as const,
  followers: (profileId: string) => ['public-profile', profileId, 'followers'] as const,
}
