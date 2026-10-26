import { describe, expect, it } from 'vitest'

import { parseSelectedNativeVideo } from './nativeVideoUpload'

describe('parseSelectedNativeVideo', () => {
  it('rejects a video longer than thirty seconds', () => {
    expect(() => parseSelectedNativeVideo({ duration: 30_001, mimeType: 'video/mp4', uri: 'file:///long.mp4' })).toThrow('30초 이하')
  })

  it('rejects a non-video MIME type', () => {
    expect(() => parseSelectedNativeVideo({ duration: 10_000, mimeType: 'image/jpeg', uri: 'file:///image.jpg' })).toThrow('MP4 또는 MOV')
  })
})
