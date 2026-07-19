import type { SupabaseClient } from '@supabase/supabase-js'

import { normalizeProfileForm, profileUpdateSchema, type ProfileUpdate } from './profileForm'

/** 프로필 데이터를 새 값으로 갱신한다. */
export async function updateProfile(
  client: SupabaseClient,
  profileId: string,
  input: unknown,
): Promise<ProfileUpdate> {
  const parsed = profileUpdateSchema.parse(input)
  const profile = { ...normalizeProfileForm(parsed), avatarPath: parsed.avatarPath }
  const response = await client
    .from('profiles')
    .update({
      display_name: profile.displayName,
      bio: profile.bio ?? null,
      mbti: profile.mbti,
      ...(profile.avatarPath ? { avatar_path: profile.avatarPath } : {}),
    })
    .eq('id', profileId)

  if (response.error) throw response.error

  return profile
}
