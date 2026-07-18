import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

const bestsellerRowSchema = z.object({
  author: z.string().min(1),
  fetched_at: z.string().datetime({ offset: true }),
  isbn13: z.string().nullable(),
  product_url: z.string().url(),
  publisher: z.string().nullable(),
  rank: z.number().int().min(1).max(10),
  source: z.literal('aladin'),
  thumbnail_url: z.string().url().nullable(),
  title: z.string().min(1),
})

export type BestsellerBook = {
  author: string
  productUrl: string
  rank: number
  thumbnailUrl: string | null
  title: string
}

export const bestsellerKeys = {
  /** 현재 저장된 베스트셀러 목록의 서버 상태를 식별할 query key를 반환한다. */
  current: ['bestseller-books'] as const,
}

/** 저장된 알라딘 베스트셀러 순위를 홈 화면 모델로 조회해 반환한다. */
export async function getCurrentBestsellers(client: SupabaseClient): Promise<BestsellerBook[]> {
  const response = await client
    .from('bestseller_books')
    .select(
      'rank, title, author, publisher, isbn13, thumbnail_url, product_url, source, fetched_at',
    )
    .order('rank', { ascending: true })

  if (response.error) throw response.error
  return parseBestsellerBooks(response.data)
}

/** 외부 DB 행 목록을 검증해 홈 화면에서 쓰는 베스트셀러 모델로 변환한다. */
export function parseBestsellerBooks(value: unknown): BestsellerBook[] {
  return z.array(bestsellerRowSchema).parse(value).map(mapBestsellerBook)
}

/** 검증된 알라딘 행 하나를 화면 모델로 변환한다. */
function mapBestsellerBook(row: z.infer<typeof bestsellerRowSchema>): BestsellerBook {
  return {
    author: row.author,
    productUrl: row.product_url,
    rank: row.rank,
    thumbnailUrl: row.thumbnail_url,
    title: row.title,
  }
}
