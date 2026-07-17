import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

const notificationPreferencesSchema = z.object({
  mentions_enabled: z.boolean(),
  replies_enabled: z.boolean(),
  room_events_enabled: z.boolean(),
})

export type NotificationPreferences = {
  mentionsEnabled: boolean
  repliesEnabled: boolean
  roomEventsEnabled: boolean
}

/** 현재 사용자의 알림 수신 설정을 조회해 반환한다. */
export async function getNotificationPreferences(
  client: SupabaseClient,
  profileId: string,
): Promise<NotificationPreferences> {
  const response = await client
    .from('notification_preferences')
    .select('replies_enabled, mentions_enabled, room_events_enabled')
    .eq('profile_id', z.string().uuid().parse(profileId))
    .single()

  if (response.error) throw response.error
  return parseNotificationPreferences(response.data)
}

/** 현재 사용자의 알림 수신 설정을 저장해 반환한다. */
export async function updateNotificationPreferences(
  client: SupabaseClient,
  profileId: string,
  preferences: NotificationPreferences,
): Promise<NotificationPreferences> {
  const values = parseNotificationPreferences({
    mentions_enabled: preferences.mentionsEnabled,
    replies_enabled: preferences.repliesEnabled,
    room_events_enabled: preferences.roomEventsEnabled,
  })
  const response = await client
    .from('notification_preferences')
    .update(toNotificationPreferenceRow(values))
    .eq('profile_id', z.string().uuid().parse(profileId))
    .select('replies_enabled, mentions_enabled, room_events_enabled')
    .single()

  if (response.error) throw response.error
  return parseNotificationPreferences(response.data)
}

/** 외부 입력을 검증해 알림 설정 도메인 모델로 변환한다. */
export function parseNotificationPreferences(value: unknown): NotificationPreferences {
  const preferences = notificationPreferencesSchema.parse(value)
  return {
    mentionsEnabled: preferences.mentions_enabled,
    repliesEnabled: preferences.replies_enabled,
    roomEventsEnabled: preferences.room_events_enabled,
  }
}

/** 알림 설정 도메인 모델을 저장소 컬럼 형식으로 변환한다. */
export function toNotificationPreferenceRow(preferences: NotificationPreferences) {
  return {
    mentions_enabled: preferences.mentionsEnabled,
    replies_enabled: preferences.repliesEnabled,
    room_events_enabled: preferences.roomEventsEnabled,
  }
}
