import { useLocalSearchParams, useRouter } from 'expo-router'
import { z } from 'zod'

import { useMobileProtectedRoute } from '../../../../../../src/features/auth/useMobileProtectedRoute'
import { MobileVideoPlayerScreen } from '../../../../../../src/features/video/MobileVideoPlayerScreen'
import { MobileRouteLoadingScreen } from '../../../../../../src/shared/ui/MobileRouteLoadingScreen'

/** 경로 값 하나를 UUID로 검증해 잘못된 영상 조회를 막는다. */
function parseVideoId(value: string | string[] | undefined): string | null {
  const result = z.string().uuid().safeParse(Array.isArray(value) ? undefined : value)
  return result.success ? result.data : null
}

/** 인증된 회원에게 서명 토큰 기반 영상 재생 화면을 표시한다. */
export default function VideoPlayerRoute(): React.JSX.Element {
  const router = useRouter()
  const parameters = useLocalSearchParams<{ videoId?: string | string[] }>()
  const videoId = parseVideoId(parameters.videoId)
  const isAllowed = useMobileProtectedRoute('/rooms')

  /** 이전 영상 보관함 화면으로 돌아간다. */
  function handleBack(): void { router.back() }

  if (!isAllowed || videoId === null) return <MobileRouteLoadingScreen label="영상을 확인하고 있어요." />
  return <MobileVideoPlayerScreen onBack={handleBack} postId={videoId} />
}
