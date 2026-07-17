import { createBrowserRouter } from 'react-router-dom'

import { AuthenticatedRoute } from '../../features/auth'
import { AuthCallbackPage } from '../../pages/auth/AuthCallbackPage'
import { LoginPage } from '../../pages/auth/LoginPage'
import { OnboardingPage } from '../../pages/onboarding/OnboardingPage'
import { AccountSettingsPage } from '../../pages/profile/AccountSettingsPage'
import { ProfileEditPage } from '../../pages/profile/ProfileEditPage'
import { ProfilePage } from '../../pages/profile/ProfilePage'
import { NotificationsPage } from '../../pages/notifications/NotificationsPage'
import { BookSearchPage } from '../../pages/rooms/BookSearchPage'
import { BookDiscussionPage } from '../../pages/rooms/BookDiscussionPage'
import { CreateRoomPage } from '../../pages/rooms/CreateRoomPage'
import { JoinRoomPage } from '../../pages/rooms/JoinRoomPage'
import { RoomDetailPage } from '../../pages/rooms/RoomDetailPage'
import { RoomsPage } from '../../pages/rooms/RoomsPage'
import { AppNavigationLayout } from './AppNavigationLayout'
import { LazyVideoArchiveRoute, LazyVideoPlayerRoute } from './LazyVideoRoutes'

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
    element: <AuthenticatedRoute />,
    children: [
      { path: '/onboarding', element: <OnboardingPage /> },
      {
        element: <AppNavigationLayout />,
        children: [
          { path: '/rooms', element: <RoomsPage /> },
          { path: '/notifications', element: <NotificationsPage /> },
          { path: '/profile', element: <ProfilePage /> },
          { path: '/profile/edit', element: <ProfileEditPage /> },
          { path: '/profile/settings', element: <AccountSettingsPage /> },
          { path: '/rooms/create', element: <CreateRoomPage /> },
          { path: '/rooms/join', element: <JoinRoomPage /> },
          { path: '/rooms/:roomId', element: <RoomDetailPage /> },
          { path: '/rooms/:roomId/books/new', element: <BookSearchPage /> },
          { path: '/rooms/:roomId/books/:bookChatId', element: <BookDiscussionPage /> },
          { path: '/rooms/:roomId/books/:bookChatId/videos', element: <LazyVideoArchiveRoute /> },
          {
            path: '/rooms/:roomId/books/:bookChatId/videos/:videoId',
            element: <LazyVideoPlayerRoute />,
          },
        ],
      },
    ],
  },
])
