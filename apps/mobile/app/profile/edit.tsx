import { useRouter } from 'expo-router'

import { useMobileProtectedRoute } from '../../src/features/auth/useMobileProtectedRoute'
import { MobileProfileEditScreen } from '../../src/features/profile/MobileProfileEditScreen'
import { MobileRouteLoadingScreen } from '../../src/shared/ui/MobileRouteLoadingScreen'

/** 인증을 마친 회원이 자신의 이름과 소개를 수정하는 경로를 표시한다. */
export default function ProfileEditRoute(): React.JSX.Element {
  const router = useRouter()
  const isAllowed = useMobileProtectedRoute('/rooms')

  /** 자기 프로필 허브로 돌아간다. */
  function handleBack(): void {
    router.replace('/profile')
  }

  /** 저장된 프로필을 새로 조회하도록 허브를 다시 연다. */
  function handleSaved(): void {
    router.replace('/profile')
  }

  if (!isAllowed) return <MobileRouteLoadingScreen label="내 정보를 확인하고 있어요." />
  return <MobileProfileEditScreen onBack={handleBack} onSaved={handleSaved} />
}
