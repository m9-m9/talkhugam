import { useLocalSearchParams, useRouter } from 'expo-router'
import { z } from 'zod'

import { useMobileProtectedRoute } from '../../src/features/auth/useMobileProtectedRoute'
import { MobilePublicProfileScreen } from '../../src/features/profile/MobilePublicProfileScreen'
import { MobileRouteLoadingScreen } from '../../src/shared/ui/MobileRouteLoadingScreen'

/** 공개 프로필 경로 값을 UUID로 확인해 잘못된 식별자의 RPC 호출을 막는다. */
function parseProfileId(value: string | string[] | undefined): string | null {
  const result = z.string().uuid().safeParse(Array.isArray(value) ? undefined : value)
  return result.success ? result.data : null
}

/** 인증된 회원에게 공개 프로필과 단방향 팔로우 화면을 표시한다. */
export default function PublicProfileRoute(): React.JSX.Element {
  const router = useRouter()
  const parameters = useLocalSearchParams<{ profileId?: string | string[] }>()
  const profileId = parseProfileId(parameters.profileId)
  const isAllowed = useMobileProtectedRoute('/rooms')

  /** 공개 프로필을 닫고 책방 목록으로 안전하게 돌아간다. */
  function handleBack(): void { router.back() }

  if (!isAllowed || profileId === null) return <MobileRouteLoadingScreen label="프로필을 확인하고 있어요." />
  return <MobilePublicProfileScreen onBack={handleBack} profileId={profileId} />
}
