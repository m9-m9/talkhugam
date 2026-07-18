import { parseAladinBestsellers, type AladinBestseller } from './schema.ts'

const ALADIN_ITEM_LIST_ENDPOINT = 'https://www.aladin.co.kr/ttb/api/ItemList.aspx'

export class AladinBestsellerError extends Error {
  /** 알라딘 API 응답 상태를 보존한 오류 인스턴스를 생성한다. */
  constructor(readonly upstreamStatus: number) {
    super('Aladin bestseller request failed')
    this.name = 'AladinBestsellerError'
  }
}

/** 알라딘 국내 도서 베스트셀러 목록을 조회할 URL을 생성한다. */
export function createAladinBestsellerUrl(ttbKey: string): URL {
  const url = new URL(ALADIN_ITEM_LIST_ENDPOINT)
  url.searchParams.set('ttbkey', ttbKey)
  url.searchParams.set('QueryType', 'Bestseller')
  url.searchParams.set('SearchTarget', 'Book')
  url.searchParams.set('MaxResults', '10')
  url.searchParams.set('start', '1')
  url.searchParams.set('output', 'js')
  url.searchParams.set('Version', '20131101')
  url.searchParams.set('Cover', 'MidBig')
  return url
}

/** 알라딘 API에서 현재 국내 도서 베스트셀러를 요청하고 검증해 반환한다. */
export async function fetchAladinBestsellers(
  ttbKey: string,
  fetcher: typeof fetch = fetch,
): Promise<AladinBestseller[]> {
  const response = await fetcher(createAladinBestsellerUrl(ttbKey), {
    headers: { accept: 'application/json' },
    method: 'GET',
  })

  if (!response.ok) throw new AladinBestsellerError(response.status)

  const value: unknown = await response.json()
  return parseAladinBestsellers(value)
}
