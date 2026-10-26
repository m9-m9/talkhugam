import { useLocalSearchParams, useRouter } from 'expo-router'

import { parseInviteToken } from '@talkhugam/domain'

import { parseMobileReturnPath } from '../../src/features/auth/mobileReturnRoute'
import { useMobileProtectedRoute } from '../../src/features/auth/useMobileProtectedRoute'
import { JoinRoomScreen } from '../../src/features/reading-room/JoinRoomScreen'
import { MobileRouteLoadingScreen } from '../../src/shared/ui/MobileRouteLoadingScreen'

/** 인증된 회원이 검증된 초대 코드 또는 링크 토큰으로 책방에 참여하는 경로를 표시한다. */
export default function JoinRoomRoute(): React.JSX.Element {
  const router = useRouter()
  const parameters = useLocalSearchParams<{ invite?: string | string[] }>()
  const inviteToken = parseInviteToken(parameters.invite)
  const returnPath = parseMobileReturnPath(
    inviteToken === null ? null : `/rooms/join?invite=${inviteToken}`,
  )
  const isAllowed = useMobileProtectedRoute('/rooms', returnPath)

  /** 참여 성공 뒤 멤버 전용 책방 목록으로 이동한다. */
  function handleJoined(): void {
    router.replace('/rooms')
  }

  if (!isAllowed) return <MobileRouteLoadingScreen label="초대 정보를 확인하고 있어요." />

  return <JoinRoomScreen inviteToken={inviteToken} onJoined={handleJoined} />
}
