import { describe, expect, it, vi } from 'vitest'
import { markMobileNotificationRead } from './mobileNotification'

describe('markMobileNotificationRead', () => {
  it('sends one validated id through the scoped read RPC', async () => {
    const rpc = vi.fn(async () => ({ error: null }))
    await markMobileNotificationRead({ rpc } as never, '00000000-0000-4000-8000-000000000001')
    expect(rpc).toHaveBeenCalledWith('mark_notifications_read', {
      p_notification_ids: ['00000000-0000-4000-8000-000000000001'], p_read_all_before: null,
    })
  })
})
