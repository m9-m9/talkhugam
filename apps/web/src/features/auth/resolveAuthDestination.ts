export type AuthDestination = '/onboarding' | '/rooms'

export function resolveAuthDestination(onboardingCompletedAt: string | null): AuthDestination {
  return onboardingCompletedAt === null ? '/onboarding' : '/rooms'
}
