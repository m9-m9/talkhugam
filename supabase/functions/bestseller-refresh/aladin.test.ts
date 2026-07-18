import { assertEquals, assertRejects } from 'jsr:@std/assert@1.0.14'

import {
  AladinBestsellerError,
  createAladinBestsellerUrl,
  fetchAladinBestsellers,
} from './aladin.ts'

Deno.test('createAladinBestsellerUrl requests the domestic book bestseller list as JSON', () => {
  const url = createAladinBestsellerUrl('ttb-key')

  assertEquals(url.origin, 'https://www.aladin.co.kr')
  assertEquals(url.pathname, '/ttb/api/ItemList.aspx')
  assertEquals(url.searchParams.get('QueryType'), 'Bestseller')
  assertEquals(url.searchParams.get('SearchTarget'), 'Book')
  assertEquals(url.searchParams.get('MaxResults'), '10')
  assertEquals(url.searchParams.get('output'), 'js')
  assertEquals(url.searchParams.get('ttbkey'), 'ttb-key')
})

Deno.test('fetchAladinBestsellers maps the response into the stored current ranking', async () => {
  const fetcher: typeof fetch = async () =>
    Response.json({
      item: [
        {
          author: '기시미 이치로, 고가 후미타케 (지은이)',
          cover: 'https://image.aladin.co.kr/product/1/2/cover500.jpg',
          isbn13: '9788996991342',
          link: 'https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=1',
          publisher: '인플루엔셜',
          title: '미움받을 용기',
        },
      ],
    })

  const items = await fetchAladinBestsellers('ttb-key', fetcher)

  assertEquals(items, [
    {
      author: '기시미 이치로, 고가 후미타케 (지은이)',
      isbn13: '9788996991342',
      productUrl: 'https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=1',
      publisher: '인플루엔셜',
      rank: 1,
      thumbnailUrl: 'https://image.aladin.co.kr/product/1/2/cover500.jpg',
      title: '미움받을 용기',
    },
  ])
})

Deno.test('fetchAladinBestsellers identifies an upstream failure as retryable', async () => {
  const fetcher: typeof fetch = async () => new Response('temporary failure', { status: 503 })

  await assertRejects(
    () => fetchAladinBestsellers('ttb-key', fetcher),
    AladinBestsellerError,
  )
})
