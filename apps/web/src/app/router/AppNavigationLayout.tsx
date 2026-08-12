import { matchPath, Outlet, useLocation } from 'react-router-dom'

import { FeedbackLauncher } from '../../features/feedback'
import { AppBottomNavigation } from '../../shared/ui/AppBottomNavigation'

/** 앱 이동 레이아웃 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
export function AppNavigationLayout() {
  const { pathname } = useLocation()
  const bookChatMatch = matchPath({ end: true, path: '/rooms/:roomId/books/:bookChatId' }, pathname)
  const videoPlayerMatch = matchPath(
    { end: true, path: '/rooms/:roomId/books/:bookChatId/videos/:videoId' },
    pathname,
  )
  const videoCreateMatch = matchPath(
    { end: true, path: '/rooms/:roomId/books/:bookChatId/videos' },
    pathname,
  )
  const profileEditMatch = matchPath({ end: true, path: '/profile/edit' }, pathname)
  const profileSettingsMatch = matchPath({ end: false, path: '/profile/settings' }, pathname)
  const isBookChat = Boolean(bookChatMatch && bookChatMatch.params.bookChatId !== 'new')
  const isImmersiveDetail =
    isBookChat ||
    Boolean(videoCreateMatch) ||
    Boolean(videoPlayerMatch) ||
    Boolean(profileEditMatch) ||
    Boolean(profileSettingsMatch)

  return (
    <div className={isImmersiveDetail ? undefined : 'app-with-bottom-navigation'}>
      <Outlet />
      {isImmersiveDetail ? null : <FeedbackLauncher />}
      {isImmersiveDetail ? null : <AppBottomNavigation />}
    </div>
  )
}
