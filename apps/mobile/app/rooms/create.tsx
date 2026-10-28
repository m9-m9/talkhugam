import { useRouter } from 'expo-router'

import { useMobileProtectedRoute } from '../../src/features/auth/useMobileProtectedRoute'
import { CreateRoomScreen } from '../../src/features/reading-room/CreateRoomScreen'
import { MobileRouteLoadingScreen } from '../../src/shared/ui/MobileRouteLoadingScreen'

/** 인증된 회원이 비공개 책방을 만들고 초대 코드를 확인하는 경로를 표시한다. */
export default function CreateRoomRoute(): React.JSX.Element {
  const router = useRouter()
  const isAllowed = useMobileProtectedRoute('/rooms')

  /** 초대 코드 확인 뒤 최신 책방 목록으로 돌아간다. */
  function handleFinished(): void {
    router.replace('/rooms')
  }

  if (!isAllowed) return <MobileRouteLoadingScreen label="책방 만들기를 준비하고 있어요." />

  return <CreateRoomScreen onBack={() => router.back()} onFinished={handleFinished} />
}
