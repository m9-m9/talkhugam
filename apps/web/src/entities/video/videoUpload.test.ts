import { describe, expect, it } from 'vitest'
import { validateVideoDuration } from './videoUpload'
describe('validateVideoDuration', () => {
  it('accepts videos at most 30 seconds', () => {
    expect(validateVideoDuration(30)).toBe(true)
    expect(validateVideoDuration(30.1)).toBe(false)
  })
})
