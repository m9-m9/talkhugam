import {
  hasRequiredLegalConsent,
  parseLegalConsentRecords,
  parseOnboardingStatus,
  resolveAuthDestination,
  type AuthDestination,
} from '@talkhugam/domain'
import type { SupabaseClient } from '@supabase/supabase-js'

/** 인증된 계정의 현재 정책 동의와 온보딩 상태를 확인해 안전한 다음 경로를 반환한다. */
export async function resolveMobileAuthDestination(
  client: SupabaseClient,
): Promise<AuthDestination> {
  const userResponse = await client.auth.getUser()
  if (userResponse.error) throw userResponse.error
  if (!userResponse.data.user) throw new Error('로그인 정보를 확인하지 못했어요.')

  const profileId = userResponse.data.user.id
  const [consentResponse, profileResponse] = await Promise.all([
    client
      .from('user_legal_consents')
      .select('document_type, document_version')
      .eq('profile_id', profileId),
    client.from('profiles').select('onboarding_completed_at').eq('id', profileId).single(),
  ])
  if (consentResponse.error) throw consentResponse.error
  if (profileResponse.error) throw profileResponse.error

  const consents = parseLegalConsentRecords(consentResponse.data)
  const onboardingStatus = parseOnboardingStatus(profileResponse.data)

  return resolveAuthDestination(
    onboardingStatus.onboarding_completed_at,
    hasRequiredLegalConsent(consents),
  )
}
