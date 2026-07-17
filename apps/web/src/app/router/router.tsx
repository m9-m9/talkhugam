import { createBrowserRouter } from 'react-router-dom'

import { AuthCallbackPage } from '../../pages/auth/AuthCallbackPage'
import { LoginPage } from '../../pages/auth/LoginPage'
import { OnboardingPage } from '../../pages/onboarding/OnboardingPage'
import { BookSearchPage } from '../../pages/rooms/BookSearchPage'
import { BookDiscussionPage } from '../../pages/rooms/BookDiscussionPage'
import { CreateRoomPage } from '../../pages/rooms/CreateRoomPage'
import { JoinRoomPage } from '../../pages/rooms/JoinRoomPage'
import { RoomDetailPage } from '../../pages/rooms/RoomDetailPage'
import { VideoUploadPage } from '../../pages/rooms/VideoUploadPage'
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
  {
    path: '/rooms/create',
    element: <CreateRoomPage />,
  },
  {
    path: '/rooms/join',
    element: <JoinRoomPage />,
  },
  {
    path: '/rooms/:roomId',
    element: <RoomDetailPage />,
  },
  {
    path: '/rooms/:roomId/books/new',
    element: <BookSearchPage />,
  },
  { path: '/rooms/:roomId/books/:bookChatId', element: <BookDiscussionPage /> },
  { path: '/rooms/:roomId/books/:bookChatId/video', element: <VideoUploadPage /> },
])
