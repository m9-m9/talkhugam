import { createBrowserRouter } from 'react-router-dom'

import { AuthCallbackPage } from '../../pages/auth/AuthCallbackPage'
import { LoginPage } from '../../pages/auth/LoginPage'
import { OnboardingPage } from '../../pages/onboarding/OnboardingPage'
import { AccountSettingsPage } from '../../pages/profile/AccountSettingsPage'
import { ProfileEditPage } from '../../pages/profile/ProfileEditPage'
import { ProfilePage } from '../../pages/profile/ProfilePage'
import { BookSearchPage } from '../../pages/rooms/BookSearchPage'
import { BookDiscussionPage } from '../../pages/rooms/BookDiscussionPage'
import { CreateRoomPage } from '../../pages/rooms/CreateRoomPage'
import { JoinRoomPage } from '../../pages/rooms/JoinRoomPage'
import { RoomDetailPage } from '../../pages/rooms/RoomDetailPage'
import { VideoArchivePage } from '../../pages/rooms/VideoArchivePage'
import { RoomsPage } from '../../pages/rooms/RoomsPage'
import { AppNavigationLayout } from './AppNavigationLayout'

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
    element: <AppNavigationLayout />,
    children: [
      { path: '/rooms', element: <RoomsPage /> },
      { path: '/profile', element: <ProfilePage /> },
      { path: '/profile/edit', element: <ProfileEditPage /> },
      { path: '/profile/settings', element: <AccountSettingsPage /> },
      { path: '/rooms/create', element: <CreateRoomPage /> },
      { path: '/rooms/join', element: <JoinRoomPage /> },
      { path: '/rooms/:roomId', element: <RoomDetailPage /> },
      { path: '/rooms/:roomId/books/new', element: <BookSearchPage /> },
      { path: '/rooms/:roomId/books/:bookChatId', element: <BookDiscussionPage /> },
      { path: '/rooms/:roomId/books/:bookChatId/videos', element: <VideoArchivePage /> },
    ],
  },
])
