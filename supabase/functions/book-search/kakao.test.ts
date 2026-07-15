import {
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from 'jsr:@std/assert@1.0.14'
import { createKakaoBookUrl, fetchKakaoBooks, KakaoBookSearchError } from './kakao.ts'

const input = {
  query: '클린 코드',
  page: 2,
  size: 5,
  target: 'title',
} as const

Deno.test('createKakaoBookUrl maps supported query parameters', () => {
  const url = createKakaoBookUrl(input)

  assertEquals(url.origin + url.pathname, 'https://dapi.kakao.com/v3/search/book')
  assertEquals(url.searchParams.get('query'), '클린 코드')
  assertEquals(url.searchParams.get('page'), '2')
  assertEquals(url.searchParams.get('size'), '5')
  assertEquals(url.searchParams.get('target'), 'title')
})

Deno.test('fetchKakaoBooks sends the REST key only in Authorization header', async () => {
  let requestedUrl = ''
  let authorization = ''
  const fetcher: typeof fetch = (request, init) => {
    requestedUrl = String(request)
    authorization = new Headers(init?.headers).get('authorization') ?? ''

    return Promise.resolve(new Response(JSON.stringify({
      meta: { total_count: 0, pageable_count: 0, is_end: true },
      documents: [],
    }), { status: 200 }))
  }

  await fetchKakaoBooks(input, 'server-secret', fetcher)

  assertStringIncludes(requestedUrl, 'query=%ED%81%B4%EB%A6%B0+%EC%BD%94%EB%93%9C')
  assertEquals(requestedUrl.includes('server-secret'), false)
  assertEquals(authorization, 'KakaoAK server-secret')
})

Deno.test('fetchKakaoBooks marks upstream throttling as retryable', async () => {
  const fetcher: typeof fetch = () => Promise.resolve(new Response(null, { status: 429 }))
  const error = await assertRejects(
    () => fetchKakaoBooks(input, 'server-secret', fetcher),
    KakaoBookSearchError,
  )

  assertEquals(error.upstreamStatus, 429)
  assertEquals(error.isRetryable, true)
})
