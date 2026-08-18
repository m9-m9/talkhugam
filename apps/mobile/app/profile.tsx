import { useRouter } from 'expo-router'

import { useMobileProtectedRoute } from '../src/features/auth/useMobileProtectedRoute'
import { MobileProfileScreen } from '../src/features/profile/MobileProfileScreen'
import { MobileRouteLoadingScreen } from '../src/shared/ui/MobileRouteLoadingScreen'

/** 인증·필수 동의·온보딩을 마친 회원의 자기 프로필과 계정 허브를 표시한다. */
export default function ProfileRoute(): React.JSX.Element {
  const router = useRouter()
  const isAllowed = useMobileProtectedRoute('/rooms')

  /** 책방 목록으로 안전하게 돌아간다. */
  function handleBack(): void {
    router.replace('/rooms')
  }

  /** 자기 프로필 편집 경로로 이동한다. */
  function handleEditProfile(): void {
    router.push('/profile/edit')
  }

  /** 로그아웃 성공 뒤 로그인 시작 화면을 히스토리에 남기지 않고 연다. */
  function handleSignedOut(): void {
    router.replace('/')
  }

  if (!isAllowed) return <MobileRouteLoadingScreen label="내 정보를 확인하고 있어요." />
  return <MobileProfileScreen onBack={handleBack} onEditProfile={handleEditProfile} onSignedOut={handleSignedOut} />
}
