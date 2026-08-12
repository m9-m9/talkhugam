import type { SupabaseClient } from '@supabase/supabase-js'

import { parseOnboardingCompletedAt } from './onboardingCompletion'
import { normalizeProfileForm, profileFormSchema, type ProfileForm } from './profileForm'

/** 프로필 입력값과 온보딩 완료 시각을 함께 저장한다. */
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
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq('id', profileId)
    .select('onboarding_completed_at')
    .single()

  if (response.error) throw response.error
  parseOnboardingCompletedAt(response.data.onboarding_completed_at)
}

/** Initial 프로필 입력 폼 데이터를 생성해 반환한다. */
export function createInitialProfileForm(displayName: string | undefined): ProfileForm {
  return {
    displayName: displayName?.trim() || '',
    bio: '',
  }
}
