import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

const profileSchema = z.object({
  display_name: z.string(),
  bio: z.string().nullable(),
  mbti: z.string().nullable(),
})

export type Profile = {
  displayName: string
  bio: string | null
  mbti: string | null
}

/** 프로필 데이터를 조회하거나 계산해 반환한다. */
export async function getProfile(client: SupabaseClient, profileId: string): Promise<Profile> {
  const response = await client
    .from('profiles')
    .select('display_name, bio, mbti')
    .eq('id', profileId)
    .single()

  if (response.error) throw response.error

  const row = profileSchema.parse(response.data)
  return { displayName: row.display_name, bio: row.bio, mbti: row.mbti }
}
