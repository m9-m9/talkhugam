import { Outlet } from 'react-router-dom'

import { AppBottomNavigation } from '../../shared/ui/AppBottomNavigation'

export function AppNavigationLayout() {
  return (
    <div className="app-with-bottom-navigation">
      <Outlet />
      <AppBottomNavigation />
    </div>
  )
}
