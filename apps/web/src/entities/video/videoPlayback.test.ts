import { describe, expect, it } from 'vitest'

import {
  createMuxThumbnailUrl,
  filterVideoPosts,
  getUploadedVideoNavigationState,
  mapVideoThumbnailAuthorizations,
  parseVideoFilterMembers,
  parseVideoPlaybackAuthorization,
  parseVideoThumbnailAuthorizations,
  parseVideoPosts,
  shouldRefreshVideoPosts,
  shouldShowUploadedVideoPlaceholder,
} from './videoUpload'

describe('parseVideoPlaybackAuthorization', () => {
  it('parses an authenticated Mux playback response', () => {
    expect(
      parseVideoPlaybackAuthorization({
        data: {
          expiresAt: 1_784_269_999,
          playbackId: 'playback-id',
          thumbnailToken: 'signed-thumbnail-token',
          token: 'signed-token',
        },
        ok: true,
      }),
    ).toEqual({
      expiresAt: 1_784_269_999,
      playbackId: 'playback-id',
      thumbnailToken: 'signed-thumbnail-token',
      token: 'signed-token',
    })
  })

  it('rejects a response without a signed token', () => {
    expect(() =>
      parseVideoPlaybackAuthorization({
        data: {
          expiresAt: 1_784_269_999,
          playbackId: 'playback-id',
          thumbnailToken: 'signed-thumbnail-token',
        },
        ok: true,
      }),
    ).toThrow()
  })
})

describe('parseVideoThumbnailAuthorizations', () => {
  it('parses a batch thumbnail response and maps it by video post', () => {
    const authorizations = parseVideoThumbnailAuthorizations({
      data: {
        thumbnails: [
          {
            expiresAt: 1_784_269_999,
            playbackId: 'playback-id',
            postId: '4b7227b2-5350-4a61-9114-b2d0c915fd1b',
            thumbnailToken: 'signed-thumbnail-token',
          },
        ],
      },
      ok: true,
    })

    expect(
      mapVideoThumbnailAuthorizations(authorizations).get('4b7227b2-5350-4a61-9114-b2d0c915fd1b'),
    ).toEqual({
      expiresAt: 1_784_269_999,
      playbackId: 'playback-id',
      postId: '4b7227b2-5350-4a61-9114-b2d0c915fd1b',
      thumbnailToken: 'signed-thumbnail-token',
    })
  })

  it('rejects a thumbnail response without a source post identifier', () => {
    expect(() =>
      parseVideoThumbnailAuthorizations({
        data: {
          thumbnails: [
            {
              expiresAt: 1_784_269_999,
              playbackId: 'playback-id',
              thumbnailToken: 'signed-thumbnail-token',
            },
          ],
        },
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
          author_member_id: '8fc963a4-da01-4696-995c-755fe145776f',
          author_name_snapshot: '민규',
          body: null,
          created_at: '2026-07-17T06:00:00+00:00',
          id: '4b7227b2-5350-4a61-9114-b2d0c915fd1b',
          video_assets: { status: 'processing' },
        },
      ]),
    ).toEqual([
      {
        authorMemberId: '8fc963a4-da01-4696-995c-755fe145776f',
        authorName: '민규',
        body: null,
        createdAt: '2026-07-17T06:00:00+00:00',
        id: '4b7227b2-5350-4a61-9114-b2d0c915fd1b',
        status: 'processing',
      },
    ])
  })

  it('filters videos by the current member or a selected room member', () => {
    const videos = [
      createVideoPost('video-1', 'member-1', '민규'),
      createVideoPost('video-2', 'member-2', '수진'),
    ]

    expect(filterVideoPosts(videos, { kind: 'mine', memberId: 'member-1' })).toEqual([videos[0]])
    expect(filterVideoPosts(videos, { kind: 'member', memberId: 'member-2' })).toEqual([videos[1]])
    expect(filterVideoPosts(videos, { kind: 'all' })).toEqual(videos)
  })

  it('maps room members and marks the signed-in member', () => {
    expect(
      parseVideoFilterMembers(
        [
          {
            id: '8fc963a4-da01-4696-995c-755fe145776f',
            profile_id: '4b7227b2-5350-4a61-9114-b2d0c915fd1b',
            room_display_name: '민규',
          },
        ],
        '4b7227b2-5350-4a61-9114-b2d0c915fd1b',
      ),
    ).toEqual([
      {
        displayName: '민규',
        id: '8fc963a4-da01-4696-995c-755fe145776f',
        isCurrentUser: true,
      },
    ])
  })

  it('builds a signed Mux thumbnail URL without unsigned image parameters', () => {
    expect(
      createMuxThumbnailUrl({
        expiresAt: 1_784_269_999,
        playbackId: 'playback-id',
        thumbnailToken: 'signed thumbnail token',
        token: 'signed-token',
      }),
    ).toBe('https://image.mux.com/playback-id/thumbnail.webp?token=signed%20thumbnail%20token')
  })

  it('only refreshes while a video is still being prepared', () => {
    expect(
      shouldRefreshVideoPosts([
        {
          authorMemberId: '10a56aa4-c753-4dcb-979e-4f87aa9f3821',
          authorName: '민규',
          body: null,
          createdAt: '2026-07-17T06:00:00+00:00',
          id: '4b7227b2-5350-4a61-9114-b2d0c915fd1b',
          status: 'ready',
        },
      ]),
    ).toBe(false)
  })

  it('keeps refreshing until a just-uploaded video is returned by the list query', () => {
    expect(
      shouldRefreshVideoPosts(
        [],
        {
          uploadedVideoPostId: '4b7227b2-5350-4a61-9114-b2d0c915fd1b',
          uploadedVideoStartedAt: 1_784_269_000_000,
        },
        1_784_269_001_000,
      ),
    ).toBe(true)
  })

  it('does not show an upload placeholder for stale navigation state', () => {
    expect(
      shouldShowUploadedVideoPlaceholder(
        [],
        {
          uploadedVideoPostId: '4b7227b2-5350-4a61-9114-b2d0c915fd1b',
          uploadedVideoStartedAt: 1_784_269_000_000,
        },
        1_784_269_046_000,
      ),
    ).toBe(false)
  })

  it('reads only fresh valid upload navigation state', () => {
    expect(
      getUploadedVideoNavigationState({
        uploadedVideoPostId: '4b7227b2-5350-4a61-9114-b2d0c915fd1b',
        uploadedVideoStartedAt: 1_784_269_000_000,
      }),
    ).toEqual({
      uploadedVideoPostId: '4b7227b2-5350-4a61-9114-b2d0c915fd1b',
      uploadedVideoStartedAt: 1_784_269_000_000,
    })
    expect(getUploadedVideoNavigationState({ uploadedVideoPostId: 'not-a-uuid' })).toBeNull()
    expect(
      getUploadedVideoNavigationState({
        uploadedVideoPostId: '4b7227b2-5350-4a61-9114-b2d0c915fd1b',
      }),
    ).toBeNull()
  })
})

function createVideoPost(id: string, authorMemberId: string, authorName: string) {
  return {
    authorMemberId,
    authorName,
    body: null,
    createdAt: '2026-07-17T06:00:00+00:00',
    id,
    status: 'ready' as const,
  }
}
