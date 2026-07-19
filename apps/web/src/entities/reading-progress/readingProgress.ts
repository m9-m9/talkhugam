import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

const readingProgressSchema = z.object({
  book_chat_id: z.string().uuid(),
  current_page: z.number().int().nonnegative(),
  total_pages: z.number().int().positive(),
  updated_at: z.string().datetime({ offset: true }),
})

const readingProgressInputSchema = z
  .object({
    bookChatId: z.string().uuid(),
    currentPage: z.number().int().nonnegative(),
    totalPages: z.number().int().positive(),
  })
  .refine((input) => input.currentPage <= input.totalPages, {
    message: '현재 페이지는 전체 페이지보다 클 수 없어요.',
    path: ['currentPage'],
  })

export type ReadingProgress = {
  bookChatId: string
  currentPage: number
  totalPages: number
  updatedAt: string
}

export type ReadingProgressInput = z.infer<typeof readingProgressInputSchema>

export const readingProgressKeys = {
  /** 프로필별 개인 독서 진행률 서버 상태를 식별할 query key를 반환한다. */
  byProfile: (profileId: string) => ['reading-progresses', profileId] as const,
}

/** 현재 사용자가 기록한 모든 책 대화의 개인 독서 진행률을 조회해 반환한다. */
export async function getMyReadingProgresses(
  client: SupabaseClient,
  profileId: string,
): Promise<ReadingProgress[]> {
  const parsedProfileId = z.string().uuid().parse(profileId)
  const response = await client
    .from('book_chat_reading_progresses')
    .select('book_chat_id,current_page,total_pages,updated_at')
    .eq('profile_id', parsedProfileId)
    .order('updated_at', { ascending: false })

  if (response.error) throw response.error
  return parseReadingProgresses(response.data)
}

/** 현재 사용자가 입력한 개인 독서 페이지와 전체 페이지 수를 검증해 저장한다. */
export async function upsertReadingProgress(
  client: SupabaseClient,
  input: ReadingProgressInput,
): Promise<void> {
  const parsed = readingProgressInputSchema.parse(input)
  const response = await client.rpc('upsert_book_chat_reading_progress', {
    p_book_chat_id: parsed.bookChatId,
    p_current_page: parsed.currentPage,
    p_total_pages: parsed.totalPages,
  })

  if (response.error) throw response.error
}

/** 외부 조회 행을 검증해 화면에서 사용할 개인 독서 진행률 목록으로 변환한다. */
export function parseReadingProgresses(value: unknown): ReadingProgress[] {
  return z.array(readingProgressSchema).parse(value).map(mapReadingProgress)
}

/** 현재·전체 페이지로 화면에 표시할 반올림 독서 진행률을 계산해 반환한다. */
export function calculateReadingProgressPercent(currentPage: number, totalPages: number): number {
  const parsed = readingProgressInputSchema.parse({
    bookChatId: '00000000-0000-0000-0000-000000000000',
    currentPage,
    totalPages,
  })
  return Math.round((parsed.currentPage / parsed.totalPages) * 100)
}

/** 원본 조회 행을 camelCase 개인 독서 진행률 모델로 변환한다. */
function mapReadingProgress(row: z.infer<typeof readingProgressSchema>): ReadingProgress {
  return {
    bookChatId: row.book_chat_id,
    currentPage: row.current_page,
    totalPages: row.total_pages,
    updatedAt: row.updated_at,
  }
}
