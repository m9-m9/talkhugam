import { z } from 'npm:zod@4.4.3'

const aladinBestsellerItemSchema = z.object({
  author: z.string().trim().min(1),
  cover: z.string().url().nullable().optional(),
  isbn13: z.string().trim().min(1).nullable().optional(),
  link: z.string().url(),
  publisher: z.string().trim().min(1).nullable().optional(),
  title: z.string().trim().min(1),
})

const aladinBestsellerResponseSchema = z.object({
  item: z.array(aladinBestsellerItemSchema).min(1).max(10),
})

export type AladinBestseller = {
  author: string
  isbn13: string | null
  productUrl: string
  publisher: string | null
  rank: number
  thumbnailUrl: string | null
  title: string
}

/** 알라딘 응답을 검증해 저장 가능한 현재 베스트셀러 순위로 변환한다. */
export function parseAladinBestsellers(value: unknown): AladinBestseller[] {
  return aladinBestsellerResponseSchema.parse(value).item.map((item, index) => ({
    author: item.author,
    isbn13: item.isbn13 ?? null,
    productUrl: item.link,
    publisher: item.publisher ?? null,
    rank: index + 1,
    thumbnailUrl: item.cover ?? null,
    title: item.title,
  }))
}
