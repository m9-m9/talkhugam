import { createBrowserRouter } from 'react-router-dom'

import { HomePage } from '../../pages/home/HomePage'
import { AuthCallbackPage } from '../../pages/auth/AuthCallbackPage'
import { LoginPage } from '../../pages/auth/LoginPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <LoginPage />,
  },
  {
    path: '/auth/callback',
    element: <AuthCallbackPage />,
  },
  {
    path: '/onboarding',
    element: <HomePage />,
  },
  {
    path: '/rooms',
    element: <HomePage />,
  },
])
