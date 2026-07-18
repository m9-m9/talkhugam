import { describe, expect, it, vi } from 'vitest'

import { getCurrentBestsellers } from './bestseller'

describe('getCurrentBestsellers', () => {
  it('maps stored Aladin ranks into the homepage card model', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          author: '기시미 이치로',
          fetched_at: '2026-07-19T00:00:00.000Z',
          isbn13: '9788996991342',
          product_url: 'https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=1',
          publisher: '인플루엔셜',
          rank: 1,
          source: 'aladin',
          thumbnail_url: 'https://image.aladin.co.kr/product/1/2/cover500.jpg',
          title: '미움받을 용기',
        },
      ],
      error: null,
    })
    const select = vi.fn(() => ({ order }))
    const client = { from: vi.fn(() => ({ select })) }

    await expect(getCurrentBestsellers(client as never)).resolves.toEqual([
      {
        author: '기시미 이치로',
        productUrl: 'https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=1',
        rank: 1,
        thumbnailUrl: 'https://image.aladin.co.kr/product/1/2/cover500.jpg',
        title: '미움받을 용기',
      },
    ])
    expect(client.from).toHaveBeenCalledWith('bestseller_books')
    expect(order).toHaveBeenCalledWith('rank', { ascending: true })
  })
})
