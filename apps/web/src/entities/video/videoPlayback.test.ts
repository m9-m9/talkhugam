import { describe, expect, it } from 'vitest'

import {
  parseVideoPlaybackAuthorization,
  parseVideoPosts,
  shouldRefreshVideoPosts,
} from './videoUpload'

describe('parseVideoPlaybackAuthorization', () => {
  it('parses an authenticated Mux playback response', () => {
    expect(
      parseVideoPlaybackAuthorization({
        data: { expiresAt: 1_784_269_999, playbackId: 'playback-id', token: 'signed-token' },
        ok: true,
      }),
    ).toEqual({ expiresAt: 1_784_269_999, playbackId: 'playback-id', token: 'signed-token' })
  })

  it('rejects a response without a signed token', () => {
    expect(() =>
      parseVideoPlaybackAuthorization({
        data: { expiresAt: 1_784_269_999, playbackId: 'playback-id' },
        ok: true,
      }),
    ).toThrow()
  })
})

describe('video feed state', () => {
  it('maps the embedded asset status for a video post', () => {
    expect(
      parseVideoPosts([
        {
          author_name_snapshot: '민규',
          body: null,
          created_at: '2026-07-17T06:00:00+00:00',
          id: '4b7227b2-5350-4a61-9114-b2d0c915fd1b',
          video_assets: { status: 'processing' },
        },
      ]),
    ).toEqual([
      {
        authorName: '민규',
        body: null,
        createdAt: '2026-07-17T06:00:00+00:00',
        id: '4b7227b2-5350-4a61-9114-b2d0c915fd1b',
        status: 'processing',
      },
    ])
  })

  it('only refreshes while a video is still being prepared', () => {
    expect(
      shouldRefreshVideoPosts([
        {
          authorName: '민규',
          body: null,
          createdAt: '2026-07-17T06:00:00+00:00',
          id: '4b7227b2-5350-4a61-9114-b2d0c915fd1b',
          status: 'ready',
        },
      ]),
    ).toBe(false)
  })
})
