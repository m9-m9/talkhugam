import * as Application from 'expo-application'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { Platform } from 'react-native'

import { registerMobilePushToken } from '../../entities/profile'
import { useMobileSessionProfileId } from '../../shared/api/MobileAppProviders'
import { createMobileSupabaseClient } from '../../shared/api/mobileSupabaseClient'
import { parseMobileNotificationTargetPath } from './mobileNotificationTarget'

/** 인증 세션에서만 기기 푸시 토큰을 등록하고 알림 응답을 안전한 내부 경로로 연결한다. */
export function MobilePushRegistration(): null {
  const profileId = useMobileSessionProfileId()
  const router = useRouter()
  useEffect(() => {
    if (profileId === null || !Device.isDevice) return
    let active = true
    /** 알림 payload의 허용 경로만 현재 앱 라우터에 전달한다. */
    function openResponse(response: Notifications.NotificationResponse | null): void {
      const path = parseMobileNotificationTargetPath(response?.notification.request.content.data?.targetPath)
      if (path !== null) router.push(path)
    }
    async function register(): Promise<void> {
      const current = await Notifications.getPermissionsAsync()
      const permission = current.granted ? current : await Notifications.requestPermissionsAsync()
      if (!permission.granted || !active) return
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
      if (!projectId) return
      const token = await Notifications.getExpoPushTokenAsync({ projectId })
      if (!active) return
      await registerMobilePushToken(createMobileSupabaseClient(), token.data, Platform.OS)
    }
    void register().catch(() => undefined)
    void Notifications.getLastNotificationResponseAsync().then(openResponse).catch(() => undefined)
    const subscription = Notifications.addNotificationResponseReceivedListener(openResponse)
    return () => { active = false; subscription.remove() }
  }, [profileId, router])
  return null
}
