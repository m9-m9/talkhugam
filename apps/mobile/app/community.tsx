import { useRouter } from 'expo-router'
import { useMobileProtectedRoute } from '../src/features/auth/useMobileProtectedRoute'
import { MobileCommunityRoomsScreen } from '../src/features/community/MobileCommunityRoomsScreen'
import { MobileRouteLoadingScreen } from '../src/shared/ui/MobileRouteLoadingScreen'

/** 인증을 마친 회원에게 오픈 책방 발견 목록을 제공하는 경로를 표시한다. */
export default function CommunityRoute(): React.JSX.Element {
  const router = useRouter(); const isAllowed = useMobileProtectedRoute('/rooms')
  /** 새 오픈 책방 생성 화면을 연다. */
  function handleCreateRoom(): void { router.push('/community/create') }
  /** 선택한 방의 비밀번호 필요 여부를 넘겨 참여 화면을 연다. */
  function handleJoinRoom(roomId: string, requiresPassword: boolean): void { router.push({ pathname: '/community/[roomId]/join', params: { roomId, requiresPassword: String(requiresPassword) } }) }
  if (!isAllowed) return <MobileRouteLoadingScreen label="오픈 책방을 불러오고 있어요." />
  return <MobileCommunityRoomsScreen onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} />
}
