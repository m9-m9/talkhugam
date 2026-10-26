import { describe, expect, it } from 'vitest'

import { parsePickedPhoto } from './pickedPhoto'

describe('parsePickedPhoto', () => {
  it('고른 사진의 주소와 크기만 꺼낸다', () => {
    expect(
      parsePickedPhoto({
        assets: [{ exif: { secret: 'gps' }, height: 4032, uri: 'file:///page.jpg', width: 3024 }],
        canceled: false,
      }),
    ).toEqual({ height: 4032, uri: 'file:///page.jpg', width: 3024 })
  })

  it('취소했거나 결과가 올바르지 않으면 null을 돌려준다', () => {
    expect(parsePickedPhoto({ assets: null, canceled: true })).toBeNull()
    expect(parsePickedPhoto({ assets: [{ uri: '', width: 0, height: 0 }], canceled: false })).toBeNull()
    expect(parsePickedPhoto(undefined)).toBeNull()
  })
})
