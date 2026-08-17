import { useRouter } from 'expo-router'

import { LegalConsentScreen } from '../src/features/legal/LegalConsentScreen'
import { resolveMobileAuthDestination } from '../src/features/auth/resolveMobileAuthDestination'
import { saveMobileRequiredLegalConsents } from '../src/entities/legal/saveMobileRequiredLegalConsents'
import { createMobileSupabaseClient } from '../src/shared/api/mobileSupabaseClient'
import { useMobileProtectedRoute } from '../src/features/auth/useMobileProtectedRoute'
import { MobileRouteLoadingScreen } from '../src/shared/ui/MobileRouteLoadingScreen'

/** 필수 약관 동의를 저장한 뒤 검증된 계정 상태에 맞는 모바일 화면으로 이동한다. */
export default function LegalConsentRoute(): React.JSX.Element {
  const router = useRouter()
  const isAllowed = useMobileProtectedRoute('/legal-consent')

  /** 전용 RPC로 동의를 저장하고 현재 프로필의 다음 접근 경로로 바꾼다. */
  async function handleSubmit(): Promise<void> {
    const client = createMobileSupabaseClient()
    await saveMobileRequiredLegalConsents(client)
    router.replace(await resolveMobileAuthDestination(client))
  }

  if (!isAllowed) return <MobileRouteLoadingScreen label="계정 정보를 확인하고 있어요." />

  return <LegalConsentScreen onSubmit={handleSubmit} />
}
