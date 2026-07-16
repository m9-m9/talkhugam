import type { SupabaseClient } from '@supabase/supabase-js'

import { parseOnboardingCompletedAt } from './onboardingCompletion'

export async function getOnboardingCompletedAt(client: SupabaseClient, profileId: string) {
  const response = await client
    .from('profiles')
    .select('onboarding_completed_at')
    .eq('id', profileId)
    .single()

  if (response.error) throw response.error

  return parseOnboardingCompletedAt(response.data.onboarding_completed_at)
}
