import { createBrowserRouter } from 'react-router-dom'

import { HomePage } from '../../pages/home/HomePage'
import { resolveAuthDestination } from '../../features/auth/resolveAuthDestination'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <HomePage />,
  },
  {
    path: '/auth/callback',
    loader: () => ({ destination: resolveAuthDestination(null) }),
    element: <HomePage />,
  },
])
