import { describe, expect, it } from 'vitest'

import { createAvatarObjectPath, getAvatarUploadError, validateAvatarUpload } from './avatarUpload'

const profileId = '00000000-0000-4000-8000-000000000001'

describe('avatarUpload', () => {
  it('uses one stable private object path for a profile', () => {
    expect(createAvatarObjectPath(profileId)).toBe(`${profileId}/avatar`)
  })

  it('accepts an allowed image under the five megabyte limit', () => {
    expect(
      validateAvatarUpload({ name: 'profile.webp', size: 5 * 1024 * 1024, type: 'image/webp' }),
    ).toEqual({ name: 'profile.webp', size: 5 * 1024 * 1024, type: 'image/webp' })
  })

  it('rejects an unsupported file type before it reaches Storage', () => {
    expect(() => validateAvatarUpload({ name: 'profile.gif', size: 1, type: 'image/gif' })).toThrow(
      'JPG, PNG, WebP 이미지만 올릴 수 있어요.',
    )
  })

  it('returns a clear message when the image exceeds the limit', () => {
    expect(
      getAvatarUploadError({ name: 'profile.png', size: 5 * 1024 * 1024 + 1, type: 'image/png' }),
    ).toBe('사진은 5MB 이하만 올릴 수 있어요.')
  })
})
