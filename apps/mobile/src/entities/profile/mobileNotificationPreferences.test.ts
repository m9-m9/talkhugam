import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import {
  getMobileNotificationPreferences,
  updateMobileNotificationPreferences,
} from './mobileNotificationPreferences'

const profileId = '4493a33c-c880-4743-a03d-1dae1cd28309'
const preferencesRow = {
  mentions_enabled: true,
  replies_enabled: false,
  room_events_enabled: true,
}

/** 인증 사용자와 알림 설정 행을 제공하는 최소 Supabase 클라이언트를 만든다. */
function createClient(input?: { userId?: string | null }) {
  const single = vi.fn(async () => ({ data: preferencesRow, error: null }))
  const eq = vi.fn(() => ({ single }))
  const select = vi.fn(() => ({ eq }))
  const updateSelect = vi.fn(() => ({ single }))
  const updateEq = vi.fn(() => ({ select: updateSelect }))
  const update = vi.fn(() => ({ eq: updateEq }))
  const from = vi.fn(() => ({ select, update }))
  const getUser = vi.fn(async () => ({
    data: { user: input?.userId === null ? null : { id: input?.userId ?? profileId } },
    error: null,
  }))

  return {
    client: { auth: { getUser }, from } as unknown as SupabaseClient,
    from,
    getUser,
    select,
    update,
    updateEq,
  }
}

describe('mobileNotificationPreferences', () => {
  it('reads notification preferences only through the authenticated profile boundary', async () => {
    const { client, from, select } = createClient()

    await expect(getMobileNotificationPreferences(client)).resolves.toEqual({
      mentionsEnabled: true,
      repliesEnabled: false,
      roomEventsEnabled: true,
    })
    expect(from).toHaveBeenCalledWith('notification_preferences')
    expect(select).toHaveBeenCalledWith('replies_enabled, mentions_enabled, room_events_enabled')
  })

  it('rejects an unauthenticated preference write before querying Supabase', async () => {
    const { client, from } = createClient({ userId: null })

    await expect(
      updateMobileNotificationPreferences(client, {
        mentionsEnabled: false,
        repliesEnabled: true,
        roomEventsEnabled: false,
      }),
    ).rejects.toThrow('로그인 정보를 확인하지 못했어요.')
    expect(from).not.toHaveBeenCalled()
  })

  it('persists the requested switches only for the authenticated profile id', async () => {
    const { client, update, updateEq } = createClient()

    await updateMobileNotificationPreferences(client, {
      mentionsEnabled: false,
      repliesEnabled: true,
      roomEventsEnabled: false,
    })

    expect(update).toHaveBeenCalledWith({
      mentions_enabled: false,
      replies_enabled: true,
      room_events_enabled: false,
    })
    expect(updateEq).toHaveBeenCalledWith('profile_id', profileId)
  })
})
