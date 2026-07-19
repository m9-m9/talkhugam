import { describe, expect, it } from 'vitest'

import { createProfileAvatarPath, validateProfileAvatarFile } from './profileAvatar'

describe('validateProfileAvatarFile', () => {
  it('accepts a JPEG image up to 5MB', () => {
    const file = new File(['image'], 'profile.jpg', { type: 'image/jpeg' })

    expect(validateProfileAvatarFile(file)).toEqual({ isValid: true })
  })

  it('rejects an unsupported image format', () => {
    const file = new File(['image'], 'profile.gif', { type: 'image/gif' })

    expect(validateProfileAvatarFile(file)).toEqual({
      isValid: false,
      message: 'JPG, PNG, WebP 형식의 사진만 올릴 수 있어요.',
    })
  })

  it('rejects an image larger than 5MB', () => {
    const file = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'profile.png', {
      type: 'image/png',
    })

    expect(validateProfileAvatarFile(file)).toEqual({
      isValid: false,
      message: '사진은 5MB 이하만 올릴 수 있어요.',
    })
  })
})

describe('createProfileAvatarPath', () => {
  it('creates a private path under the current profile directory', () => {
    expect(createProfileAvatarPath('profile-id')).toBe('profiles/profile-id/avatar')
  })
})
