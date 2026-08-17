import { useRouter } from 'expo-router'

import { useMobileProtectedRoute } from '../src/features/auth/useMobileProtectedRoute'
import { MobileReadingRoomsScreen } from '../src/features/reading-room/MobileReadingRoomsScreen'
import { MobileRouteLoadingScreen } from '../src/shared/ui/MobileRouteLoadingScreen'

/** 인증·약관·온보딩을 완료한 회원의 비공개 책방 목록 경로를 표시한다. */
export default function RoomsRoute(): React.JSX.Element {
  const router = useRouter()
  const isAllowed = useMobileProtectedRoute('/rooms')

  /** 새 비공개 책방 생성 경로로 이동한다. */
  function handleCreateRoom(): void {
    router.push('/rooms/create')
  }

  /** 초대 코드 또는 링크 토큰 참여 경로로 이동한다. */
  function handleJoinRoom(): void {
    router.push('/rooms/join')
  }

  if (!isAllowed) return <MobileRouteLoadingScreen label="책방을 불러오고 있어요." />

  return <MobileReadingRoomsScreen onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} />
}
