import { assertEquals } from 'jsr:@std/assert@1.0.14'
import { mapKakaoBookResponse, parseIsbn } from './mapper.ts'

const input = {
  query: '미움받을 용기',
  page: 1,
  size: 10,
} as const

Deno.test('parseIsbn separates ISBN10 and ISBN13', () => {
  assertEquals(parseIsbn('8996991341 9788996991342'), {
    isbn10: '8996991341',
    isbn13: '9788996991342',
  })
})

Deno.test('mapKakaoBookResponse keeps only internal book fields', () => {
  const result = mapKakaoBookResponse({
    meta: { total_count: 1, pageable_count: 1, is_end: true },
    documents: [{
      title: ' 미움받을 용기 ',
      contents: '외부 원문은 저장 계약에 포함하지 않는다.',
      url: 'https://search.daum.net/book/1',
      isbn: '8996991341 9788996991342',
      datetime: '2014-11-17T00:00:00.000+09:00',
      authors: ['기시미 이치로', ' 고가 후미타케 '],
      publisher: '인플루엔셜',
      translators: [],
      price: 14900,
      sale_price: 13410,
      thumbnail: 'https://example.com/cover.jpg',
      status: '정상판매',
    }],
  }, input)

  assertEquals(result, {
    items: [{
      source: 'kakao',
      isbn10: '8996991341',
      isbn13: '9788996991342',
      title: '미움받을 용기',
      authors: ['기시미 이치로', '고가 후미타케'],
      publisher: '인플루엔셜',
      publishedAt: '2014-11-17',
      thumbnailUrl: 'https://example.com/cover.jpg',
      externalUrl: 'https://search.daum.net/book/1',
    }],
    page: 1,
    size: 10,
    totalCount: 1,
    pageableCount: 1,
    isEnd: true,
  })
})
