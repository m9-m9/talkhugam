import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  getMobileNotifications,
  markMobileNotificationRead,
  mobileNotificationKeys,
  type MobileNotification,
} from '../../entities/notification/mobileNotification'
import { createMobileSupabaseClient } from '../../shared/api/mobileSupabaseClient'
import { mobileButtonStyles, mobileColors } from '../../shared/ui/mobileTheme'
import { parseMobileNotificationTargetPath } from './mobileNotificationTarget'

type MobileNotificationsScreenProps = {
  onBack?: () => void
  onOpen(path: string): void
}

/** 앱 내부 알림의 조회·읽음 처리·안전한 화면 이동을 다크 화면 프레임 안에 표시한다. */
export function MobileNotificationsScreen({
  onBack,
  onOpen,
}: MobileNotificationsScreenProps): React.JSX.Element {
  const client = useQueryClient()
  const [openError, setOpenError] = useState<string | null>(null)
  const query = useQuery({
    queryKey: mobileNotificationKeys.all,
    queryFn: () => getMobileNotifications(createMobileSupabaseClient()),
  })
  const read = useMutation({
    mutationFn: (id: string) => markMobileNotificationRead(createMobileSupabaseClient(), id),
    onSuccess: () => client.invalidateQueries({ queryKey: mobileNotificationKeys.all }),
  })

  /** 읽지 않은 알림을 읽음으로 바꾼 뒤, 앱 안의 안전한 경로일 때만 이동한다. */
  async function handleOpen(notification: MobileNotification): Promise<void> {
    setOpenError(null)
    try {
      if (!notification.isRead) await read.mutateAsync(notification.id)
    } catch {
      setOpenError('알림을 읽음으로 바꾸지 못했어요. 다시 눌러 주세요.')
      return
    }
    const path = parseMobileNotificationTargetPath(notification.targetPath)
    if (path) onOpen(path)
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {onBack ? (
          <Pressable
            accessibilityLabel="이전 화면으로 돌아가기"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onBack}
            style={styles.backButton}
          >
            <Text style={styles.backText}>이전</Text>
          </Pressable>
        ) : null}
        <Text accessibilityRole="header" style={styles.title}>
          알림
        </Text>
      </View>
      <NotificationsBody
        isOpening={read.isPending}
        notifications={query.data}
        onOpen={(notification) => void handleOpen(notification)}
        onRetry={() => void query.refetch()}
        openError={openError}
        status={query.isPending ? 'loading' : query.isError ? 'error' : 'ready'}
      />
    </SafeAreaView>
  )
}

type NotificationsBodyProps = {
  isOpening: boolean
  notifications: MobileNotification[] | undefined
  onOpen(notification: MobileNotification): void
  onRetry(): void
  openError: string | null
  status: 'error' | 'loading' | 'ready'
}

/** 알림 목록의 로딩·오류·빈 상태·목록 중 하나를 같은 프레임 안에 보여 준다. */
function NotificationsBody({
  isOpening,
  notifications,
  onOpen,
  onRetry,
  openError,
  status,
}: NotificationsBodyProps): React.JSX.Element {
  if (status === 'loading') {
    return (
      <View accessibilityLabel="알림을 불러오고 있어요." accessibilityRole="progressbar" accessible style={styles.state}>
        <ActivityIndicator color={mobileColors.accent} />
        <Text style={styles.stateText}>알림을 불러오고 있어요.</Text>
      </View>
    )
  }
  if (status === 'error') {
    return (
      <View style={styles.state}>
        <Text accessibilityRole="alert" style={styles.errorText}>
          알림을 불러오지 못했어요.
        </Text>
        <Pressable
          accessibilityLabel="알림 다시 불러오기"
          accessibilityRole="button"
          onPress={onRetry}
          style={({ pressed }) => [
            styles.retryButton,
            mobileButtonStyles.secondary,
            pressed && mobileButtonStyles.secondaryPressed,
          ]}
        >
          <Text style={[styles.retryText, mobileButtonStyles.secondaryText]}>다시 시도</Text>
        </Pressable>
      </View>
    )
  }
  if (!notifications?.length) {
    return (
      <View style={styles.state}>
        <Text style={styles.stateText}>아직 새로운 알림이 없어요</Text>
      </View>
    )
  }
  return (
    <ScrollView contentContainerStyle={styles.list}>
      {openError ? (
        <Text accessibilityRole="alert" style={styles.errorText}>
          {openError}
        </Text>
      ) : null}
      {notifications.map((notification) => (
        <Pressable
          accessibilityLabel={notification.message}
          accessibilityRole="button"
          accessibilityState={{ busy: isOpening, disabled: isOpening }}
          disabled={isOpening}
          key={notification.id}
          onPress={() => onOpen(notification)}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        >
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[styles.unreadDot, notification.isRead && styles.readDot]}
          />
          <View style={styles.rowCopy}>
            <Text style={styles.message}>{notification.message}</Text>
            <Text style={styles.readState}>{notification.isRead ? '읽음' : '새 알림'}</Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  backButton: { alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44, minWidth: 44 },
  backText: { color: mobileColors.ink, fontSize: 15, fontWeight: '600' },
  container: { backgroundColor: mobileColors.surface, flex: 1, paddingHorizontal: 16 },
  errorText: { color: mobileColors.danger, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  header: { gap: 8, paddingTop: 8 },
  list: { paddingBottom: 32, paddingTop: 16 },
  message: { color: mobileColors.ink, fontSize: 15, lineHeight: 22 },
  readDot: { backgroundColor: mobileColors.borderStrong },
  readState: { color: mobileColors.inkSubtle, fontSize: 13, lineHeight: 20, marginTop: 4 },
  retryButton: {
    alignItems: 'center',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
  },
  retryText: { fontSize: 15, fontWeight: '600' },
  row: {
    alignItems: 'flex-start',
    borderBottomColor: mobileColors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 64,
    paddingVertical: 12,
  },
  rowCopy: { flex: 1 },
  rowPressed: { backgroundColor: mobileColors.surfacePressed },
  state: { alignItems: 'center', gap: 12, marginTop: 48 },
  stateText: { color: mobileColors.inkSubtle, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  title: { color: mobileColors.ink, fontSize: 24, fontWeight: '700', lineHeight: 32 },
  unreadDot: {
    backgroundColor: mobileColors.accent,
    borderRadius: 4,
    height: 8,
    marginTop: 7,
    width: 8,
  },
})
