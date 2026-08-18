import { describe, expect, it } from 'vitest'

import { parseMobileAvatarFile } from './mobileProfileAvatar'

describe('parseMobileAvatarFile', () => {
  it('accepts a supported image no larger than five megabytes', () => {
    expect(parseMobileAvatarFile({ fileSize: 5 * 1024 * 1024, mimeType: 'image/png', uri: 'file:///avatar.png' })).toEqual({ fileSize: 5 * 1024 * 1024, mimeType: 'image/png', uri: 'file:///avatar.png' })
  })

  it('rejects an unsupported image or an oversized file', () => {
    expect(() => parseMobileAvatarFile({ fileSize: 1, mimeType: 'image/gif', uri: 'file:///avatar.gif' })).toThrow('JPG, PNG, WebP')
    expect(() => parseMobileAvatarFile({ fileSize: 5 * 1024 * 1024 + 1, mimeType: 'image/png', uri: 'file:///avatar.png' })).toThrow('5MB')
  })
})
