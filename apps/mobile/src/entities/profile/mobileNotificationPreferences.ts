import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { getMobileAuthenticatedProfileId } from './mobileProfile'

const mobileNotificationPreferencesSchema = z.object({
  mentions_enabled: z.boolean(),
  replies_enabled: z.boolean(),
  room_events_enabled: z.boolean(),
})

const mobileNotificationPreferencesInputSchema = z.object({
  mentionsEnabled: z.boolean(),
  repliesEnabled: z.boolean(),
  roomEventsEnabled: z.boolean(),
})

export type MobileNotificationPreferences = {
  mentionsEnabled: boolean
  repliesEnabled: boolean
  roomEventsEnabled: boolean
}

/** 알림 설정 행을 네이티브 화면의 명시적인 수신 상태로 변환한다. */
function mapMobileNotificationPreferences(input: unknown): MobileNotificationPreferences {
  const preferences = mobileNotificationPreferencesSchema.parse(input)
  return {
    mentionsEnabled: preferences.mentions_enabled,
    repliesEnabled: preferences.replies_enabled,
    roomEventsEnabled: preferences.room_events_enabled,
  }
}

/** 현재 로그인한 회원에게만 허용된 알림 수신 설정을 조회한다. */
export async function getMobileNotificationPreferences(
  client: SupabaseClient,
): Promise<MobileNotificationPreferences> {
  const profileId = await getMobileAuthenticatedProfileId(client)
  const response = await client
    .from('notification_preferences')
    .select('replies_enabled, mentions_enabled, room_events_enabled')
    .eq('profile_id', profileId)
    .single()

  if (response.error) throw response.error
  return mapMobileNotificationPreferences(response.data)
}

/** 현재 로그인한 회원의 알림 수신 설정만 검증해 저장하고 최신 값을 반환한다. */
export async function updateMobileNotificationPreferences(
  client: SupabaseClient,
  input: unknown,
): Promise<MobileNotificationPreferences> {
  const preferences = mobileNotificationPreferencesInputSchema.parse(input)
  const profileId = await getMobileAuthenticatedProfileId(client)
  const response = await client
    .from('notification_preferences')
    .update({
      mentions_enabled: preferences.mentionsEnabled,
      replies_enabled: preferences.repliesEnabled,
      room_events_enabled: preferences.roomEventsEnabled,
    })
    .eq('profile_id', profileId)
    .select('replies_enabled, mentions_enabled, room_events_enabled')
    .single()

  if (response.error) throw response.error
  return mapMobileNotificationPreferences(response.data)
}
