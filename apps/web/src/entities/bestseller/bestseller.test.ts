import { describe, expect, it, vi } from 'vitest'

import { getBookBestsellers, parseBookBestsellerResponse } from './bestseller'

describe('parseBookBestsellerResponse', () => {
  it('keeps a missing Aladin key as a configured-false empty result', () => {
    expect(
      parseBookBestsellerResponse({
        data: { isConfigured: false, items: [] },
        ok: true,
        requestId: 'request-id',
      }),
    ).toEqual({ isConfigured: false, items: [] })
  })

  it('accepts only the validated bestseller card fields', () => {
    expect(
      parseBookBestsellerResponse({
        data: {
          isConfigured: true,
          items: [
            {
              authors: ['기시미 이치로'],
              externalUrl: 'https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=1',
              id: '9788996991342',
              publisher: '인플루엔셜',
              thumbnailUrl: 'https://image.aladin.co.kr/product/1/1/cover500/1.jpg',
              title: '미움받을 용기',
            },
          ],
        },
        ok: true,
        requestId: 'request-id',
      }),
    ).toEqual({
      isConfigured: true,
      items: [
        {
          authors: ['기시미 이치로'],
          externalUrl: 'https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=1',
          id: '9788996991342',
          publisher: '인플루엔셜',
          thumbnailUrl: 'https://image.aladin.co.kr/product/1/1/cover500/1.jpg',
          title: '미움받을 용기',
        },
      ],
    })
  })
})

describe('getBookBestsellers', () => {
  it('invokes the server-only bestseller function without a browser key', async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: { data: { isConfigured: false, items: [] }, ok: true, requestId: 'request-id' },
      error: null,
    })

    await expect(getBookBestsellers({ functions: { invoke } } as never)).resolves.toEqual({
      isConfigured: false,
      items: [],
    })
    expect(invoke).toHaveBeenCalledWith('book-bestsellers')
  })
})
