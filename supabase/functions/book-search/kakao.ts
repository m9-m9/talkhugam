import type { BookSearchInput, BookSearchResult } from './schema.ts'
import { mapKakaoBookResponse } from './mapper.ts'

const KAKAO_BOOK_ENDPOINT = 'https://dapi.kakao.com/v3/search/book'

export class KakaoBookSearchError extends Error {
  constructor(
    readonly upstreamStatus: number,
    readonly isRetryable: boolean,
  ) {
    super('Kakao book search failed')
    this.name = 'KakaoBookSearchError'
  }
}

export function createKakaoBookUrl(input: BookSearchInput): URL {
  const url = new URL(KAKAO_BOOK_ENDPOINT)
  url.searchParams.set('query', input.query)
  url.searchParams.set('page', String(input.page))
  url.searchParams.set('size', String(input.size))
  if (input.target) url.searchParams.set('target', input.target)
  return url
}

export async function fetchKakaoBooks(
  input: BookSearchInput,
  restApiKey: string,
  fetcher: typeof fetch = fetch,
): Promise<BookSearchResult> {
  const response = await fetcher(createKakaoBookUrl(input), {
    method: 'GET',
    headers: {
      accept: 'application/json',
      authorization: `KakaoAK ${restApiKey}`,
    },
  })

  if (!response.ok) {
    throw new KakaoBookSearchError(response.status, response.status === 429 || response.status >= 500)
  }

  const value: unknown = await response.json()
  return mapKakaoBookResponse(value, input)
}
