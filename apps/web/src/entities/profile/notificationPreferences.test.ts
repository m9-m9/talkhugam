import { describe, expect, it } from 'vitest'

import {
  parseNotificationPreferences,
  toNotificationPreferenceRow,
} from './notificationPreferences'

describe('notification preferences', () => {
  it('maps the signed-in member notification settings', async () => {
    expect(
      parseNotificationPreferences({
        mentions_enabled: false,
        replies_enabled: true,
        room_events_enabled: false,
      }),
    ).toEqual({
      mentionsEnabled: false,
      repliesEnabled: true,
      roomEventsEnabled: false,
    })
  })

  it('converts the UI setting names to the database update fields', () => {
    expect(
      toNotificationPreferenceRow({
        mentionsEnabled: true,
        repliesEnabled: false,
        roomEventsEnabled: true,
      }),
    ).toEqual({
      mentions_enabled: true,
      replies_enabled: false,
      room_events_enabled: true,
    })
  })
})
