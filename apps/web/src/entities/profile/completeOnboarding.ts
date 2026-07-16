import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { normalizeProfileForm, profileFormSchema, type ProfileForm } from './profileForm'

const completedProfileSchema = z.object({
  onboarding_completed_at: z.string().datetime(),
})

export async function completeOnboarding(
  client: SupabaseClient,
  profileId: string,
  input: unknown,
): Promise<void> {
  const profile = normalizeProfileForm(profileFormSchema.parse(input))
  const response = await client
    .from('profiles')
    .update({
      display_name: profile.displayName,
      bio: profile.bio ?? null,
      mbti: profile.mbti,
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq('id', profileId)
    .select('onboarding_completed_at')
    .single()

  if (response.error) throw response.error
  completedProfileSchema.parse(response.data)
}

export function createInitialProfileForm(displayName: string | undefined): ProfileForm {
  return {
    displayName: displayName?.trim() || '',
    bio: '',
    mbti: null,
  }
}
