import { afterEach, describe, expect, it, vi } from 'vitest'

import { isPhotoDecodeError } from './photoDecodeError'
import { resizePhotoForOcr } from './photoResize'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('resizePhotoForOcr', () => {
  it('브라우저가 사진을 디코드하지 못하면 사진 형식 오류로 바꿔 던진다', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockRejectedValue(new DOMException('bad', 'InvalidStateError')),
    )

    const error: unknown = await resizePhotoForOcr(
      new File(['heic'], 'IMG_0001.HEIC', { type: 'image/heic' }),
    ).catch((reason: unknown) => reason)

    expect(isPhotoDecodeError(error)).toBe(true)
  })
})
