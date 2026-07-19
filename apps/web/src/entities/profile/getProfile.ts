import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { getProfileAvatarUrl } from './profileAvatar'

const profileSchema = z.object({
  display_name: z.string(),
  avatar_path: z.string().nullable(),
  bio: z.string().nullable(),
  mbti: z.string().nullable(),
})

export type Profile = {
  avatarPath: string | null
  avatarUrl: string | null
  displayName: string
  bio: string | null
  mbti: string | null
}

/** 프로필 데이터를 조회하거나 계산해 반환한다. */
export async function getProfile(client: SupabaseClient, profileId: string): Promise<Profile> {
  const response = await client
    .from('profiles')
    .select('display_name, avatar_path, bio, mbti')
    .eq('id', profileId)
    .single()

  if (response.error) throw response.error

  const row = profileSchema.parse(response.data)
  const avatarUrl = await resolveProfileAvatarUrl(client, row.avatar_path)
  return {
    avatarPath: row.avatar_path,
    avatarUrl,
    displayName: row.display_name,
    bio: row.bio,
    mbti: row.mbti,
  }
}

/** 사진 URL 생성 실패가 프로필 본문 조회를 막지 않도록 안전한 표시 URL을 반환한다. */
async function resolveProfileAvatarUrl(
  client: SupabaseClient,
  avatarPath: string | null,
): Promise<string | null> {
  try {
    return await getProfileAvatarUrl(client, avatarPath)
  } catch {
    return null
  }
}
