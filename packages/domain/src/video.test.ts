import { describe, expect, it } from 'vitest'

import {
  createMuxThumbnailUrl,
  filterVideoPosts,
  mapVideoThumbnailAuthorizations,
  parseVideoDeletePermission,
  parseVideoPlaybackAuthorization,
  parseVideoPosts,
  validateVideoDuration,
  videoKeys,
} from './video'

describe('video domain', () => {
  it('parses signed playback data and creates a tokenized thumbnail URL', () => {
    const playback = parseVideoPlaybackAuthorization({
      data: {
        expiresAt: 1_784_269_999,
        playbackId: 'playback-id',
        thumbnailToken: 'signed thumbnail token',
        token: 'signed-token',
      },
      ok: true,
    })

    expect(createMuxThumbnailUrl(playback)).toBe(
      'https://image.mux.com/playback-id/thumbnail.webp?token=signed%20thumbnail%20token',
    )
  })

  it('maps video rows, filters by author, and creates stable cache keys', () => {
    const posts = parseVideoPosts([
      {
        author_member_id: '8fc963a4-da01-4696-995c-755fe145776f',
        author_name_snapshot: '민규',
        body: null,
        created_at: '2026-07-17T06:00:00+00:00',
        id: '4b7227b2-5350-4a61-9114-b2d0c915fd1b',
        video_assets: { status: 'ready' },
      },
    ])

    expect(filterVideoPosts(posts, { kind: 'mine', memberId: posts[0]?.authorMemberId ?? null }))
      .toEqual(posts)
    expect(videoKeys.byBookChat('book-chat-id')).toEqual(['video-posts', 'book-chat-id'])
  })

  it('maps thumbnail authorizations and enforces the thirty second duration boundary', () => {
    const authorizations = mapVideoThumbnailAuthorizations([
      {
        expiresAt: 1_784_269_999,
        playbackId: 'playback-id',
        postId: '4b7227b2-5350-4a61-9114-b2d0c915fd1b',
        thumbnailToken: 'signed-thumbnail-token',
      },
    ])

    expect(authorizations.get('4b7227b2-5350-4a61-9114-b2d0c915fd1b')?.playbackId).toBe('playback-id')
    expect(validateVideoDuration(30)).toBe(true)
    expect(validateVideoDuration(30.1)).toBe(false)
  })

  it('accepts a manager row but keeps video deletion for authors and owners', () => {
    expect(
      parseVideoDeletePermission(
        { id: '6a1f0c2e-5b3d-4c7e-9f10-2a3b4c5d6e7f', role: 'manager' },
        '7b2e1d3f-6c4a-4d8b-8a21-3b4c5d6e7f80',
      ),
    ).toEqual({ canDelete: false })
  })
})
