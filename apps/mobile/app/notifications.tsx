import { useRouter } from 'expo-router'
import { MobileNotificationsScreen } from '../src/features/notification/MobileNotificationsScreen'
import { useMobileProtectedRoute } from '../src/features/auth/useMobileProtectedRoute'
import { MobileRouteLoadingScreen } from '../src/shared/ui/MobileRouteLoadingScreen'

/** 인증된 회원에게 앱 내부 알림 목록을 표시한다. */
export default function NotificationsRoute(): React.JSX.Element {
  const router = useRouter()
  const allowed = useMobileProtectedRoute('/rooms')
  if (!allowed) return <MobileRouteLoadingScreen label="알림을 확인하고 있어요." />
  return <MobileNotificationsScreen onOpen={(path) => router.push(path)} />
}
