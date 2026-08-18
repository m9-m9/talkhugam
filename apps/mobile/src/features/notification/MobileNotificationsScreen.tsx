import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { getMobileNotifications, markMobileNotificationRead, mobileNotificationKeys, type MobileNotification } from '../../entities/notification/mobileNotification'
import { createMobileSupabaseClient } from '../../shared/api/mobileSupabaseClient'
import { parseMobileNotificationTargetPath } from './mobileNotificationTarget'

/** 앱 내부 알림의 조회·읽음 처리·안전한 화면 이동을 표시한다. */
export function MobileNotificationsScreen({ onOpen }: { onOpen(path: string): void }): React.JSX.Element {
  const client = useQueryClient()
  const query = useQuery({ queryKey: mobileNotificationKeys.all, queryFn: () => getMobileNotifications(createMobileSupabaseClient()) })
  const read = useMutation({ mutationFn: (id: string) => markMobileNotificationRead(createMobileSupabaseClient(), id), onSuccess: () => client.invalidateQueries({ queryKey: mobileNotificationKeys.all }) })
  async function handleOpen(notification: MobileNotification): Promise<void> {
    if (!notification.isRead) await read.mutateAsync(notification.id)
    const path = parseMobileNotificationTargetPath(notification.targetPath)
    if (path) onOpen(path)
  }
  if (query.isPending) return <Text accessibilityRole="progressbar">알림을 불러오고 있어요.</Text>
  if (query.isError) return <View><Text accessibilityRole="alert">알림을 불러오지 못했어요.</Text><Pressable accessibilityRole="button" accessibilityLabel="알림 다시 불러오기" onPress={() => void query.refetch()}><Text>다시 시도</Text></Pressable></View>
  if (!query.data?.length) return <Text>아직 새로운 알림이 없어요</Text>
  return <ScrollView>{query.data.map((notification) => <Pressable accessibilityRole="button" accessibilityLabel={notification.message} key={notification.id} onPress={() => void handleOpen(notification)}><Text>{notification.message}</Text><Text>{notification.isRead ? '읽음' : '새 알림'}</Text></Pressable>)}</ScrollView>
}
