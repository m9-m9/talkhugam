export type AuthDestination = '/legal-consent' | '/onboarding' | '/rooms'

/** 인증 상태와 온보딩 여부에 맞는 다음 경로를 결정한다. */
export function resolveAuthDestination(
  onboardingCompletedAt: string | null,
  hasRequiredConsent = true,
): AuthDestination {
  if (!hasRequiredConsent) return '/legal-consent'
  return onboardingCompletedAt === null ? '/onboarding' : '/rooms'
}
