import { z } from 'zod'

export const legalDocumentVersion = '2026-07-18.2' as const

const legalDocumentIdSchema = z.enum(['terms', 'privacy'])
const legalConsentRecordsSchema = z.array(
  z.object({
    document_type: legalDocumentIdSchema,
    document_version: z.string().min(1),
  }),
)
const onboardingStatusSchema = z.object({
  onboarding_completed_at: z.string().datetime({ offset: true }).nullable(),
})

const requiredLegalDocumentIds = legalDocumentIdSchema.options

export type LegalDocumentId = z.infer<typeof legalDocumentIdSchema>
export type LegalConsentRecord = z.infer<typeof legalConsentRecordsSchema>[number]
export type OnboardingStatus = z.infer<typeof onboardingStatusSchema>
export type AuthDestination = '/legal-consent' | '/onboarding' | '/rooms'

/** 외부에서 읽은 정책 동의 행을 접근 판단에 안전한 도메인 값으로 검증한다. */
export function parseLegalConsentRecords(input: unknown): LegalConsentRecord[] {
  return legalConsentRecordsSchema.parse(input)
}

/** 외부에서 읽은 온보딩 완료 시각을 안전한 라우팅 상태로 검증한다. */
export function parseOnboardingStatus(input: unknown): OnboardingStatus {
  return onboardingStatusSchema.parse(input)
}

/** 모든 현재 필수 정책 문서에 동의했는지 확인한다. */
export function hasRequiredLegalConsent(consents: readonly LegalConsentRecord[]): boolean {
  return requiredLegalDocumentIds.every((documentId) =>
    consents.some(
      (consent) =>
        consent.document_type === documentId && consent.document_version === legalDocumentVersion,
    ),
  )
}

/** 인증 뒤 필수 동의와 온보딩 상태에 맞는 다음 제품 경로를 결정한다. */
export function resolveAuthDestination(
  onboardingCompletedAt: string | null,
  hasRequiredConsent = true,
): AuthDestination {
  if (!hasRequiredConsent) return '/legal-consent'
  return onboardingCompletedAt === null ? '/onboarding' : '/rooms'
}
