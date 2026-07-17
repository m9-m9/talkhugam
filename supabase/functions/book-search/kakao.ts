import type { BookSearchInput, BookSearchResult } from './schema.ts'
import { mapKakaoBookResponse } from './mapper.ts'

const KAKAO_BOOK_ENDPOINT = 'https://dapi.kakao.com/v3/search/book'

export class KakaoBookSearchError extends Error {
  /** 전달받은 값으로 클래스 인스턴스의 초기 상태를 구성한다. */
  constructor(
    readonly upstreamStatus: number,
    readonly isRetryable: boolean,
  ) {
    super('Kakao book search failed')
    this.name = 'KakaoBookSearchError'
  }
}

/** Kakao 책 URL 데이터를 생성해 반환한다. */
export function createKakaoBookUrl(input: BookSearchInput): URL {
  const url = new URL(KAKAO_BOOK_ENDPOINT)
  url.searchParams.set('query', input.query)
  url.searchParams.set('page', String(input.page))
  url.searchParams.set('size', String(input.size))
  if (input.target) url.searchParams.set('target', input.target)
  return url
}

/** 외부 서비스에 Kakao 책 목록 데이터를 요청해 반환한다. */
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
