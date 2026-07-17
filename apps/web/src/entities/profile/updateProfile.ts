import type { SupabaseClient } from '@supabase/supabase-js'

import { normalizeProfileForm, profileFormSchema, type ProfileForm } from './profileForm'

export async function updateProfile(
  client: SupabaseClient,
  profileId: string,
  input: unknown,
): Promise<ProfileForm> {
  const profile = normalizeProfileForm(profileFormSchema.parse(input))
  const response = await client
    .from('profiles')
    .update({
      display_name: profile.displayName,
      bio: profile.bio ?? null,
      mbti: profile.mbti,
    })
    .eq('id', profileId)

  if (response.error) throw response.error

  return profile
}
