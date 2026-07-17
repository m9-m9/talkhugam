import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationsRead,
  notificationKeys,
  type AppNotification,
  type NotificationReadRequest,
} from '../../entities/notification'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { AppHeader } from '../../shared/ui/AppHeader'
import { LoadingSpinner } from '../../shared/ui/LoadingSpinner'

/** 앱 내부 알림을 확인하고 읽음 처리와 관련 화면 이동을 제공한다. */
export function NotificationsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)
  const notificationsQuery = useQuery({
    queryFn: () => getNotifications(createSupabaseClient()),
    queryKey: notificationKeys.all,
  })
  const unreadCountQuery = useQuery({
    queryFn: () => getUnreadNotificationCount(createSupabaseClient()),
    queryKey: notificationKeys.unreadCount,
  })
  const readMutation = useMutation({
    mutationFn: (request: NotificationReadRequest) =>
      markNotificationsRead(createSupabaseClient(), request),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: notificationKeys.all })
      await queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount })
    },
  })

  const notifications = notificationsQuery.data ?? []
  const newestNotification = notifications[0] ?? null
  const hasUnreadNotifications = (unreadCountQuery.data ?? 0) > 0

  /** 목록을 최신 서버 상태로 다시 조회한다. */
  function handleRetry() {
    setFeedbackMessage(null)
    void notificationsQuery.refetch()
    void unreadCountQuery.refetch()
  }

  /** 개별 알림을 읽음 처리하고 연결된 화면이 있으면 이동한다. */
  async function handleOpenNotification(notification: AppNotification) {
    setFeedbackMessage(null)
    try {
      if (!notification.isRead) await readMutation.mutateAsync({ ids: [notification.id] })
      if (notification.targetPath !== null) await navigate(notification.targetPath)
    } catch {
      setFeedbackMessage('알림을 읽음 처리하지 못했어요. 잠시 후 다시 시도해 주세요.')
    }
  }

  /** 최신 알림 시각을 기준으로 현재 사용자의 읽지 않은 알림을 모두 읽음 처리한다. */
  async function handleMarkAllRead() {
    if (newestNotification === null || !hasUnreadNotifications) return

    setFeedbackMessage(null)
    try {
      await readMutation.mutateAsync({ readAllBefore: newestNotification.createdAt })
      setFeedbackMessage('모든 알림을 읽음 처리했어요.')
    } catch {
      setFeedbackMessage('알림을 읽음 처리하지 못했어요. 잠시 후 다시 시도해 주세요.')
    }
  }

  return (
    <main className="app-page bg-surface px-4 pb-8">
      <h1 className="sr-only">알림</h1>
      <AppHeader
        action={
          <button
            className="text-primary min-h-11 cursor-pointer px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!hasUnreadNotifications || readMutation.isPending}
            onClick={() => void handleMarkAllRead()}
            type="button"
          >
            모두 읽음
          </button>
        }
        onBack={() => void navigate('/rooms')}
        title="알림"
      />
      <p aria-live="polite" className="sr-only">
        {feedbackMessage}
      </p>
      {feedbackMessage ? (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {feedbackMessage}
        </p>
      ) : null}
      <NotificationsContent
        isPending={notificationsQuery.isPending}
        isQueryError={notificationsQuery.isError}
        isReading={readMutation.isPending}
        notifications={notifications}
        onOpen={handleOpenNotification}
        onRetry={handleRetry}
      />
    </main>
  )
}

/** 알림 서버 상태에 맞는 로딩·오류·빈 목록·목록 화면을 렌더링한다. */
function NotificationsContent({
  isPending,
  isQueryError,
  isReading,
  notifications,
  onOpen,
  onRetry,
}: {
  isPending: boolean
  isQueryError: boolean
  isReading: boolean
  notifications: readonly AppNotification[]
  onOpen: (notification: AppNotification) => Promise<void>
  onRetry: () => void
}) {
  if (isPending) return <NotificationsLoadingState />
  if (isQueryError) return <NotificationsErrorState onRetry={onRetry} />
  if (notifications.length === 0) return <NotificationsEmptyState />
  return <NotificationsList isReading={isReading} notifications={notifications} onOpen={onOpen} />
}

/** 알림 조회 중임을 책 로딩 애니메이션으로 표시한다. */
function NotificationsLoadingState() {
  return (
    <div className="flex min-h-64 items-center justify-center">
      <LoadingSpinner label="알림을 불러오고 있어요." />
    </div>
  )
}

/** 알림 조회 실패를 안내하고 재시도 동작을 제공한다. */
function NotificationsErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center text-center">
      <p className="text-ink text-base font-semibold">알림을 불러오지 못했어요</p>
      <p className="text-ink-subtle mt-2 text-sm">잠시 후 다시 시도해 주세요.</p>
      <button
        className="bg-primary mt-6 min-h-11 cursor-pointer rounded-md px-4 text-sm font-semibold text-white"
        onClick={onRetry}
        type="button"
      >
        다시 시도하기
      </button>
    </div>
  )
}

/** 수신한 알림이 없을 때 화면 목적을 설명하는 빈 상태를 렌더링한다. */
function NotificationsEmptyState() {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center text-center">
      <p className="text-ink text-base font-semibold">아직 새로운 알림이 없어요</p>
      <p className="text-ink-subtle mt-2 text-sm">
        독서방에서 새 소식이 오면 이곳에 알려 드릴게요.
      </p>
    </div>
  )
}

/** 수신한 알림을 읽음 상태와 연결된 방 정보로 목록 렌더링한다. */
function NotificationsList({
  isReading,
  notifications,
  onOpen,
}: {
  isReading: boolean
  notifications: readonly AppNotification[]
  onOpen: (notification: AppNotification) => Promise<void>
}) {
  return (
    <section aria-label="알림 목록" className="py-6">
      <ul className="border-ink/10 overflow-hidden rounded-lg border bg-white">
        {notifications.map((notification) => (
          <li className="border-ink/10 border-b last:border-b-0" key={notification.id}>
            <button
              aria-label={notification.message}
              className="hover:bg-surface-muted focus-visible:ring-primary flex min-h-20 w-full cursor-pointer items-start gap-3 px-4 py-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset disabled:cursor-wait"
              disabled={isReading}
              onClick={() => void onOpen(notification)}
              type="button"
            >
              <span
                aria-hidden="true"
                className={`mt-1.5 size-2 shrink-0 rounded-full ${notification.isRead ? 'bg-ink/20' : 'bg-primary'}`}
              />
              <span className="min-w-0 flex-1">
                <span
                  className={`block text-sm ${notification.isRead ? 'text-ink-subtle' : 'text-ink font-semibold'}`}
                >
                  {notification.message}
                </span>
                {notification.roomName ? (
                  <span className="text-ink-subtle mt-1 block truncate text-xs">
                    {notification.roomName}
                  </span>
                ) : null}
                <time
                  className="text-ink-subtle mt-2 block text-xs"
                  dateTime={notification.createdAt}
                >
                  {formatNotificationTime(notification.createdAt)}
                </time>
              </span>
              {notification.targetPath ? (
                <span aria-hidden="true" className="text-ink-subtle pt-1 text-lg">
                  ›
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** ISO 시각을 알림 목록에서 읽기 쉬운 날짜·시간 문자열로 변환한다. */
function formatNotificationTime(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'numeric',
  }).format(new Date(value))
}
