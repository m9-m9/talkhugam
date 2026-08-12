import { describe, expect, it } from 'vitest'
import {
  canDeleteVideoPost,
  parseVideoDeletePermission,
  validateVideoDuration,
} from './videoUpload'
describe('validateVideoDuration', () => {
  it('accepts videos at most 30 seconds', () => {
    expect(validateVideoDuration(30)).toBe(true)
    expect(validateVideoDuration(30.1)).toBe(false)
  })
})

describe('canDeleteVideoPost', () => {
  it('allows a video author to delete their own video', () => {
    expect(
      canDeleteVideoPost({ currentMemberId: 'member-1', isRoomOwner: false }, 'member-1'),
    ).toBe(true)
  })

  it('allows a room owner to delete another member video', () => {
    expect(canDeleteVideoPost({ currentMemberId: 'member-1', isRoomOwner: true }, 'member-2')).toBe(
      true,
    )
  })

  it('denies a non-owner from deleting another member video', () => {
    expect(
      canDeleteVideoPost({ currentMemberId: 'member-1', isRoomOwner: false }, 'member-2'),
    ).toBe(false)
  })
})

describe('parseVideoDeletePermission', () => {
  it('maps an owner row to a permission that can remove another member video', () => {
    expect(
      parseVideoDeletePermission(
        { id: '8fc963a4-da01-4696-995c-755fe145776f', role: 'owner' },
        '4b7227b2-5350-4a61-9114-b2d0c915fd1b',
      ),
    ).toEqual({ canDelete: true })
  })

  it('accepts an operator membership without granting another member video deletion', () => {
    expect(
      parseVideoDeletePermission(
        { id: '8fc963a4-da01-4696-995c-755fe145776f', role: 'manager' },
        '4b7227b2-5350-4a61-9114-b2d0c915fd1b',
      ),
    ).toEqual({ canDelete: false })
  })

  it('maps an absent membership to a denied permission', () => {
    expect(parseVideoDeletePermission(null, '4b7227b2-5350-4a61-9114-b2d0c915fd1b')).toEqual({
      canDelete: false,
    })
  })
})
