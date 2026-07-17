import { describe, expect, it } from 'vitest'

import { parseVideoPlaybackAuthorization } from './videoUpload'

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
