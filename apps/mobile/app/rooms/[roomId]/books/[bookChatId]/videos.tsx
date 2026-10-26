import { useLocalSearchParams, useRouter } from 'expo-router'
import { z } from 'zod'

import { useMobileProtectedRoute } from '../../../../../src/features/auth/useMobileProtectedRoute'
import { MobileVideoArchiveScreen } from '../../../../../src/features/video/MobileVideoArchiveScreen'
import { MobileRouteLoadingScreen } from '../../../../../src/shared/ui/MobileRouteLoadingScreen'

/** URL 경로 값 하나를 UUID로 제한해 허용되지 않은 서버 조회를 막는다. */
function parseRouteId(value: string | string[] | undefined): string | null {
  const result = z.string().uuid().safeParse(Array.isArray(value) ? undefined : value)
  return result.success ? result.data : null
}

/** 인증·동의·온보딩을 마친 회원에게 해당 책 대화의 영상 기록 보관함을 표시한다. */
export default function VideoArchiveRoute(): React.JSX.Element {
  const router = useRouter()
  const parameters = useLocalSearchParams<{ bookChatId?: string | string[]; roomId?: string | string[] }>()
  const roomId = parseRouteId(parameters.roomId)
  const bookChatId = parseRouteId(parameters.bookChatId)
  const isAllowed = useMobileProtectedRoute('/rooms')

  /** 잘못된 경로 또는 보관함에서 참여 중인 책방 목록으로 안전하게 돌아간다. */
  function handleBack(): void {
    router.replace('/rooms')
  }

  /** 준비될 영상 재생 화면의 검증된 post 경로로 이동한다. */
  function handleOpenVideo(videoId: string): void {
    if (roomId === null || bookChatId === null) return
    router.push(`/rooms/${roomId}/books/${bookChatId}/videos/${videoId}`)
  }

  if (!isAllowed) return <MobileRouteLoadingScreen label="영상 기록을 확인하고 있어요." />
  if (roomId === null || bookChatId === null) return <MobileRouteLoadingScreen label="영상 기록 주소를 확인하고 있어요." />

  return <MobileVideoArchiveScreen bookChatId={bookChatId} onBack={handleBack} onOpenVideo={handleOpenVideo} roomId={roomId} />
}
