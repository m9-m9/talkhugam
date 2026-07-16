import { createBrowserRouter } from 'react-router-dom'

import { AuthCallbackPage } from '../../pages/auth/AuthCallbackPage'
import { LoginPage } from '../../pages/auth/LoginPage'
import { OnboardingPage } from '../../pages/onboarding/OnboardingPage'
import { RoomsPage } from '../../pages/rooms/RoomsPage'

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
    element: <OnboardingPage />,
  },
  {
    path: '/rooms',
    element: <RoomsPage />,
  },
])
