export {
  createMobileAuthRedirectUri,
  parseMobilePublicEnv,
  type MobilePublicEnv,
} from './mobileAuth'
export {
  hasRequiredLegalConsent,
  legalDocumentVersion,
  parseOnboardingStatus,
  parseLegalConsentRecords,
  resolveAuthDestination,
  type AuthDestination,
  type LegalConsentRecord,
  type LegalDocumentId,
  type OnboardingStatus,
} from './authFlow'
