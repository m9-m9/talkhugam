import {
  type BookSearchInput,
  type BookSearchItem,
  type BookSearchResult,
  type KakaoBookResponse,
  kakaoBookResponseSchema,
} from './schema.ts'

type IsbnPair = {
  isbn10: string | null
  isbn13: string | null
}

function optionalText(value: string): string | null {
  const normalized = value.trim()
  return normalized || null
}

export function parseIsbn(value: string): IsbnPair {
  const values = value.split(/\s+/).filter(Boolean)
  const isbn10 = values.find((isbn) => /^\d{9}[\dX]$/i.test(isbn)) ?? null
  const isbn13 = values.find((isbn) => /^\d{13}$/.test(isbn)) ?? null
  return { isbn10, isbn13 }
}

function mapDocument(document: KakaoBookResponse['documents'][number]): BookSearchItem {
  const isbn = parseIsbn(document.isbn)
  const publishedAt = document.datetime.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null

  return {
    source: 'kakao',
    ...isbn,
    title: document.title.trim(),
    authors: document.authors.map((author) => author.trim()).filter(Boolean),
    publisher: optionalText(document.publisher),
    publishedAt,
    thumbnailUrl: optionalText(document.thumbnail),
    externalUrl: optionalText(document.url),
  }
}

export function mapKakaoBookResponse(value: unknown, input: BookSearchInput): BookSearchResult {
  const response = kakaoBookResponseSchema.parse(value)

  return {
    items: response.documents.map(mapDocument),
    page: input.page,
    size: input.size,
    totalCount: response.meta.total_count,
    pageableCount: response.meta.pageable_count,
    isEnd: response.meta.is_end,
  }
}
