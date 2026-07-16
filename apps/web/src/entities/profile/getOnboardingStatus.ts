import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

const onboardingStatusSchema = z.object({
  onboarding_completed_at: z.string().datetime().nullable(),
})

export async function getOnboardingCompletedAt(client: SupabaseClient, profileId: string) {
  const response = await client
    .from('profiles')
    .select('onboarding_completed_at')
    .eq('id', profileId)
    .single()

  if (response.error) throw response.error

  return onboardingStatusSchema.parse(response.data).onboarding_completed_at
}
