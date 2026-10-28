import { describe, expect, it } from 'vitest'

import { withAlpha } from './mobileLayout'

describe('withAlpha', () => {
  it('색 토큰에 불투명도를 붙이고 범위를 벗어난 값은 자른다', () => {
    expect(withAlpha('#141312', 0.72)).toBe('#141312B8')
    expect(withAlpha('#FF835F', 0.35)).toBe('#FF835F59')
    expect(withAlpha('#FFFFFF', 2)).toBe('#FFFFFFFF')
  })
})
