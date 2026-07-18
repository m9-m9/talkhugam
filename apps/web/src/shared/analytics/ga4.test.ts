import { describe, expect, it, vi } from 'vitest'

import { createAnalyticsEventPayload, createPageViewPayload, initializeGa4 } from './ga4'

describe('createPageViewPayload', () => {
  it('keeps only the SPA path and page title', () => {
    expect(createPageViewPayload('/rooms/room-1?invite=secret', '독서방')).toEqual({
      page_location: '/rooms/room-1',
      page_title: '독서방',
    })
  })
})

describe('createAnalyticsEventPayload', () => {
  it('does not accept identifying or content fields in an event payload', () => {
    expect(createAnalyticsEventPayload('feedback_submitted')).toEqual({})
  })
})

describe('initializeGa4', () => {
  it('disables automatic page views and advertising features', () => {
    const gtag = vi.fn()

    initializeGa4('G-TEST123', gtag)

    expect(gtag).toHaveBeenCalledWith('js', expect.any(Date))
    expect(gtag).toHaveBeenCalledWith('config', 'G-TEST123', {
      allow_ad_personalization_signals: false,
      allow_google_signals: false,
      send_page_view: false,
    })
  })
})
