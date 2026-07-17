import { matchPath, Outlet, useLocation } from 'react-router-dom'

import { AppBottomNavigation } from '../../shared/ui/AppBottomNavigation'

export function AppNavigationLayout() {
  const { pathname } = useLocation()
  const bookChatMatch = matchPath({ end: true, path: '/rooms/:roomId/books/:bookChatId' }, pathname)
  const isBookChat = Boolean(bookChatMatch && bookChatMatch.params.bookChatId !== 'new')

  if (isBookChat) return <Outlet />

  return (
    <div className="app-with-bottom-navigation">
      <Outlet />
      <AppBottomNavigation />
    </div>
  )
}
