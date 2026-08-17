import { useLocalSearchParams, useRouter } from 'expo-router'
import { z } from 'zod'

import { useMobileProtectedRoute } from '../../src/features/auth/useMobileProtectedRoute'
import { MobileRoomDetailScreen } from '../../src/features/reading-room/MobileRoomDetailScreen'
import { MobileRouteLoadingScreen } from '../../src/shared/ui/MobileRouteLoadingScreen'

/** 경로 파라미터를 UUID로 제한해 잘못된 식별자의 서버 조회를 막는다. */
function parseRoomId(value: string | string[] | undefined): string | null {
  const result = z.string().uuid().safeParse(Array.isArray(value) ? undefined : value)
  return result.success ? result.data : null
}

/** 인증된 회원이 RLS로 허용된 책방과 책 대화 목록을 보는 경로를 표시한다. */
export default function RoomDetailRoute(): React.JSX.Element {
  const router = useRouter()
  const parameters = useLocalSearchParams<{ roomId?: string | string[] }>()
  const roomId = parseRoomId(parameters.roomId)
  const isAllowed = useMobileProtectedRoute('/rooms')

  /** 회원 전용 책방 목록으로 돌아간다. */
  function handleBack(): void {
    router.replace('/rooms')
  }

  /** 선택한 책 대화의 안전한 후속 경로로 이동한다. */
  function handleOpenBookChat(bookChatId: string): void {
    if (roomId === null) return
    router.push(`/rooms/${roomId}/books/${bookChatId}`)
  }

  if (!isAllowed) return <MobileRouteLoadingScreen label="책방을 확인하고 있어요." />

  return (
    <MobileRoomDetailScreen onBack={handleBack} onOpenBookChat={handleOpenBookChat} roomId={roomId} />
  )
}
