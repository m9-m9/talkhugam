import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

const profileSchema = z.object({
  avatar_path: z.string().nullable(),
  display_name: z.string(),
  bio: z.string().nullable(),
  mbti: z.string().nullable(),
  updated_at: z.string().datetime({ offset: true }),
})

export type Profile = {
  avatarPath: string | null
  displayName: string
  bio: string | null
  mbti: string | null
  updatedAt: string
}

/** 프로필 데이터를 조회하거나 계산해 반환한다. */
export async function getProfile(client: SupabaseClient, profileId: string): Promise<Profile> {
  const response = await client
    .from('profiles')
    .select('avatar_path, display_name, bio, mbti, updated_at')
    .eq('id', profileId)
    .single()

  if (response.error) throw response.error

  const row = profileSchema.parse(response.data)
  return {
    avatarPath: row.avatar_path,
    displayName: row.display_name,
    bio: row.bio,
    mbti: row.mbti,
    updatedAt: row.updated_at,
  }
}
