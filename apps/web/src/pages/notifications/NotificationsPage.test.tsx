import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { NotificationsPage } from './NotificationsPage'

const { getNotifications, getUnreadNotificationCount, markNotificationsRead } = vi.hoisted(() => ({
  getNotifications: vi.fn(),
  getUnreadNotificationCount: vi.fn(),
  markNotificationsRead: vi.fn().mockResolvedValue(1),
}))

vi.mock('../../entities/notification', () => ({
  getNotifications,
  getUnreadNotificationCount,
  markNotificationsRead,
  notificationKeys: { all: ['notifications'], unreadCount: ['notifications', 'unread-count'] },
}))

vi.mock('../../shared/api/supabaseClient', () => ({ createSupabaseClient: vi.fn(() => ({})) }))

describe('NotificationsPage', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    getNotifications.mockResolvedValue([])
    getUnreadNotificationCount.mockResolvedValue(0)
    markNotificationsRead.mockResolvedValue(1)
  })

  it('읽지 않은 답글 알림을 읽음 처리한 뒤 연결된 책 대화로 이동한다', async () => {
    getNotifications.mockResolvedValue([createNotification()])
    getUnreadNotificationCount.mockResolvedValue(1)
    renderNotificationsPage()

    fireEvent.click(await screen.findByRole('button', { name: /수진님이 답글을 남겼어요/ }))

    await waitFor(() => {
      expect(markNotificationsRead).toHaveBeenCalledWith(expect.anything(), {
        ids: ['22222222-2222-4222-8222-222222222222'],
      })
    })
    expect(await screen.findByText('/rooms/room-1/books/book-1')).toBeInTheDocument()
  })

  it('이동 대상이 없는 알림은 읽음 처리만 하고 현재 화면에 머문다', async () => {
    getNotifications.mockResolvedValue([
      createNotification({ message: '새 알림이 도착했어요.', targetPath: null, type: 'system' }),
    ])
    renderNotificationsPage()

    fireEvent.click(await screen.findByRole('button', { name: /새 알림이 도착했어요/ }))

    await waitFor(() => expect(markNotificationsRead).toHaveBeenCalledTimes(1))
    expect(screen.getByText('/notifications')).toBeInTheDocument()
  })

  it('읽음 처리 실패 시 오류를 알리고 연결된 화면으로 이동하지 않는다', async () => {
    getNotifications.mockResolvedValue([createNotification()])
    markNotificationsRead.mockRejectedValueOnce(new Error('network'))
    renderNotificationsPage()

    fireEvent.click(await screen.findByRole('button', { name: /수진님이 답글을 남겼어요/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '알림을 읽음 처리하지 못했어요. 잠시 후 다시 시도해 주세요.',
    )
    expect(screen.getByRole('button', { name: /수진님이 답글을 남겼어요/ })).toBeEnabled()
    expect(screen.getByText('/notifications')).toBeInTheDocument()
  })

  it('모두 읽음을 누르면 최신 알림 시각을 기준으로 읽음 처리한다', async () => {
    getNotifications.mockResolvedValue([
      createNotification({ createdAt: '2026-07-18T03:02:03.000Z' }),
      createNotification({ id: '33333333-3333-4333-8333-333333333333', isRead: true }),
    ])
    getUnreadNotificationCount.mockResolvedValue(1)
    renderNotificationsPage()

    await screen.findAllByRole('button', { name: /수진님이 답글을 남겼어요/ })
    fireEvent.click(await screen.findByRole('button', { name: '모두 읽음' }))

    await waitFor(() => {
      expect(markNotificationsRead).toHaveBeenCalledWith(expect.anything(), {
        readAllBefore: '2026-07-18T03:02:03.000Z',
      })
    })
  })

  it('알림 조회 실패 시 재시도 동작을 제공한다', async () => {
    getNotifications.mockRejectedValueOnce(new Error('network'))
    renderNotificationsPage()

    fireEvent.click(await screen.findByRole('button', { name: '다시 시도하기' }))

    await waitFor(() => expect(getNotifications).toHaveBeenCalledTimes(2))
  })

  it('SEED 액션 버튼과 목록 항목으로 알림 조작 요소를 렌더링한다', async () => {
    getNotifications.mockResolvedValue([createNotification()])
    getUnreadNotificationCount.mockResolvedValue(1)
    renderNotificationsPage()

    expect(await screen.findByRole('button', { name: '모두 읽음' })).toHaveClass(
      'seed-action-button',
    )
    expect(await screen.findByRole('button', { name: /수진님이 답글을 남겼어요/ })).toHaveClass(
      'seed-action-button',
    )
  })
})

/** 알림 화면 상호작용을 확인할 수 있는 기본 알림 모델을 생성한다. */
function createNotification(overrides = {}) {
  return {
    actorName: '수진',
    createdAt: '2026-07-18T01:02:03.000Z',
    id: '22222222-2222-4222-8222-222222222222',
    isRead: false,
    message: '수진님이 답글을 남겼어요.',
    roomName: '금요일 아침 독서 모임',
    targetPath: '/rooms/room-1/books/book-1',
    type: 'reply',
    ...overrides,
  }
}

/** 라우팅과 서버 상태를 포함한 알림 화면을 테스트 환경에 렌더링한다. */
function renderNotificationsPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/notifications']}>
        <Routes>
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="*" element={<p>다른 화면</p>} />
        </Routes>
        <LocationText />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** 현재 라우트 경로를 테스트에서 확인할 수 있도록 텍스트로 렌더링한다. */
function LocationText() {
  const location = useLocation()
  return <p>{location.pathname}</p>
}
