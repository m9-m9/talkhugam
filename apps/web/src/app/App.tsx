import { RouterProvider } from 'react-router-dom'

import { AppProviders } from './providers/AppProviders'
import { router } from './router/router'

/** 앱 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
export function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  )
}
