import { describe, expect, it } from 'vitest'

import { getScaledImageSize } from './ocrPhoto'

describe('getScaledImageSize', () => {
  it('긴 변을 2000px로 맞추고 비율을 유지한다', () => {
    expect(getScaledImageSize({ height: 3000, width: 4000 })).toEqual({ height: 1500, width: 2000 })
    expect(getScaledImageSize({ height: 4032, width: 3024 })).toEqual({ height: 2000, width: 1500 })
  })

  it('이미 작은 사진은 키우지 않는다', () => {
    expect(getScaledImageSize({ height: 800, width: 600 })).toEqual({ height: 800, width: 600 })
  })
})
