import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

const bestsellerSchema = z.object({
  authors: z.array(z.string()),
  externalUrl: z.string().url().nullable(),
  id: z.string().min(1),
  publisher: z.string().nullable(),
  thumbnailUrl: z.string().url().nullable(),
  title: z.string().min(1),
})

const bestsellerResultSchema = z.object({
  isConfigured: z.boolean(),
  items: z.array(bestsellerSchema),
})

const bestsellerResponseSchema = z.object({
  data: bestsellerResultSchema,
  ok: z.literal(true),
  requestId: z.string().min(1),
})

export type BookBestseller = z.infer<typeof bestsellerSchema>
export type BookBestsellerResult = z.infer<typeof bestsellerResultSchema>

export const bookBestsellerKeys = {
  current: ['book-bestsellers'] as const,
}

/** Edge Function 성공 응답을 검증해 베스트셀러 도메인 결과로 변환한다. */
export function parseBookBestsellerResponse(value: unknown): BookBestsellerResult {
  return bestsellerResponseSchema.parse(value).data
}

/** 서버 전용 알라딘 키를 사용하는 베스트셀러 목록을 조회한다. */
export async function getBookBestsellers(client: SupabaseClient): Promise<BookBestsellerResult> {
  const response = await client.functions.invoke('book-bestsellers')
  if (response.error) throw response.error

  return parseBookBestsellerResponse(response.data)
}
