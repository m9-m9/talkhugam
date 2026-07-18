import { createBrowserRouter } from 'react-router-dom'

import { AuthenticatedRoute } from '../../features/auth'
import { AuthCallbackPage } from '../../pages/auth/AuthCallbackPage'
import { LoginPage } from '../../pages/auth/LoginPage'
import { RouteRecoveryPage } from '../../pages/errors/RouteRecoveryPage'
import { OnboardingPage } from '../../pages/onboarding/OnboardingPage'
import { AccountSettingsPage } from '../../pages/profile/AccountSettingsPage'
import { MemberProfilePage } from '../../pages/profile/MemberProfilePage'
import { NaverAccountInfoPage } from '../../pages/profile/NaverAccountInfoPage'
import { ProfileEditPage } from '../../pages/profile/ProfileEditPage'
import { ProfileSharePage } from '../../pages/profile/ProfileSharePage'
import { ProfilePage } from '../../pages/profile/ProfilePage'
import { NotificationsPage } from '../../pages/notifications/NotificationsPage'
import { BookSearchPage } from '../../pages/rooms/BookSearchPage'
import { BookDiscussionPage } from '../../pages/rooms/BookDiscussionPage'
import { BookChatManagementPage } from '../../pages/rooms/BookChatManagementPage'
import { CreateRoomPage } from '../../pages/rooms/CreateRoomPage'
import { JoinRoomPage } from '../../pages/rooms/JoinRoomPage'
import { RoomDetailPage } from '../../pages/rooms/RoomDetailPage'
import { RoomManagementPage } from '../../pages/rooms/RoomManagementPage'
import { ArchivedRoomsPage } from '../../pages/rooms/ArchivedRoomsPage'
import { RoomSettingsPage } from '../../pages/rooms/RoomSettingsPage'
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
        errorElement: <RouteRecoveryPage kind="error" />,
        children: [
          { path: '/rooms', element: <RoomsPage /> },
          { path: '/notifications', element: <NotificationsPage /> },
          { path: '/profile', element: <ProfilePage /> },
          { path: '/profile/edit', element: <ProfileEditPage /> },
          { path: '/profile/share', element: <ProfileSharePage /> },
          { path: '/profile/settings', element: <AccountSettingsPage /> },
          { path: '/profile/settings/naver-info', element: <NaverAccountInfoPage /> },
          { path: '/rooms/create', element: <CreateRoomPage /> },
          { path: '/rooms/join', element: <JoinRoomPage /> },
          { path: '/rooms/archive', element: <ArchivedRoomsPage /> },
          { path: '/rooms/:roomId', element: <RoomDetailPage /> },
          { path: '/rooms/:roomId/manage', element: <RoomManagementPage /> },
          { path: '/rooms/:roomId/manage/settings', element: <RoomSettingsPage /> },
          { path: '/rooms/:roomId/members/:profileId', element: <MemberProfilePage /> },
          { path: '/rooms/:roomId/books/new', element: <BookSearchPage /> },
          { path: '/rooms/:roomId/books/:bookChatId', element: <BookDiscussionPage /> },
          { path: '/rooms/:roomId/books/:bookChatId/manage', element: <BookChatManagementPage /> },
          { path: '/rooms/:roomId/books/:bookChatId/videos', element: <LazyVideoArchiveRoute /> },
          {
            path: '/rooms/:roomId/books/:bookChatId/videos/:videoId',
            element: <LazyVideoPlayerRoute />,
          },
          { path: '*', element: <RouteRecoveryPage kind="not-found" /> },
        ],
      },
    ],
  },
])
