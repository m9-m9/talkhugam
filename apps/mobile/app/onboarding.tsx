import { useLocalSearchParams, useRouter } from 'expo-router'

import {
  createMobileAuthenticatedRoute,
  parseMobileReturnPath,
} from '../src/features/auth/mobileReturnRoute'
import { useMobileProtectedRoute } from '../src/features/auth/useMobileProtectedRoute'
import { OnboardingScreen } from '../src/features/onboarding/OnboardingScreen'
import { MobileRouteLoadingScreen } from '../src/shared/ui/MobileRouteLoadingScreen'

/** 인증과 필수 동의를 마친 새 회원이 프로필을 완성할 수 있는 온보딩 경로를 표시한다. */
export default function OnboardingRoute(): React.JSX.Element {
  const router = useRouter()
  const parameters = useLocalSearchParams<{ returnTo?: string | string[] }>()
  const returnPath = parseMobileReturnPath(parameters.returnTo)
  const isAllowed = useMobileProtectedRoute('/onboarding')

  if (!isAllowed) return <MobileRouteLoadingScreen label="계정 정보를 확인하고 있어요." />

  /** 서버 저장이 검증된 온보딩 회원을 첫 책방 화면으로 이동한다. */
  function handleCompleted(): void {
    router.replace(createMobileAuthenticatedRoute('/rooms', returnPath))
  }

  return <OnboardingScreen onCompleted={handleCompleted} />
}
