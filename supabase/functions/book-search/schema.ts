import { z } from 'zod'

export const bookSearchInputSchema = z.object({
  query: z.string().trim().min(2).max(100),
  page: z.int().min(1).max(50).default(1),
  size: z.int().min(1).max(20).default(10),
  target: z.enum(['title', 'isbn', 'publisher', 'person']).optional(),
})

export const kakaoBookResponseSchema = z.object({
  meta: z.object({
    total_count: z.int().nonnegative(),
    pageable_count: z.int().nonnegative(),
    is_end: z.boolean(),
  }),
  documents: z.array(z.object({
    title: z.string(),
    contents: z.string(),
    url: z.string(),
    isbn: z.string(),
    datetime: z.string(),
    authors: z.array(z.string()),
    publisher: z.string(),
    translators: z.array(z.string()),
    price: z.int(),
    sale_price: z.int(),
    thumbnail: z.string(),
    status: z.string(),
  })),
})

export type BookSearchInput = z.infer<typeof bookSearchInputSchema>
export type KakaoBookResponse = z.infer<typeof kakaoBookResponseSchema>

export type BookSearchItem = {
  source: 'kakao'
  isbn10: string | null
  isbn13: string | null
  title: string
  authors: string[]
  publisher: string | null
  publishedAt: string | null
  thumbnailUrl: string | null
  externalUrl: string | null
}

export type BookSearchResult = {
  items: BookSearchItem[]
  page: number
  size: number
  totalCount: number
  pageableCount: number
  isEnd: boolean
}
