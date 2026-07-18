import { z } from 'npm:zod@4.4.3'
import { createRequestId, failureResponse, successResponse } from '../_shared/api.ts'
import { createCorsHeaders, optionsResponse } from '../_shared/cors.ts'
import { readRequiredEnv } from '../_shared/env.ts'
import { logOperationalEvent } from '../_shared/logger.ts'
import { secureEqual } from '../_shared/secret.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { AladinBestsellerError, fetchAladinBestsellers } from './aladin.ts'

/** 요청의 작업자 비밀값이 베스트셀러 갱신 권한을 갖는지 확인한다. */
function isAuthorized(request: Request): boolean {
  const expected = `Bearer ${readRequiredEnv('BESTSELLER_REFRESH_SECRET')}`
  return secureEqual(request.headers.get('authorization') ?? '', expected)
}

/** 알라딘 순위 데이터를 현재 목록 테이블에 원자적으로 반영한다. */
async function saveBestsellers(bestsellers: Awaited<ReturnType<typeof fetchAladinBestsellers>>): Promise<void> {
  const admin = createAdminClient()
  const fetchedAt = new Date().toISOString()
  const response = await admin.from('bestseller_books').upsert(
    bestsellers.map((bestseller) => ({
      author: bestseller.author,
      fetched_at: fetchedAt,
      isbn13: bestseller.isbn13,
      product_url: bestseller.productUrl,
      publisher: bestseller.publisher,
      rank: bestseller.rank,
      source: 'aladin',
      thumbnail_url: bestseller.thumbnailUrl,
      title: bestseller.title,
    })),
    { onConflict: 'rank' },
  )

  if (response.error) throw response.error
}

/** 알라딘 베스트셀러 갱신 요청을 인증하고 저장 결과를 표준 응답으로 반환한다. */
export async function handleBestsellerRefresh(request: Request): Promise<Response> {
  const preflight = optionsResponse(request)
  if (preflight) return preflight

  const requestId = createRequestId(request)
  const headers = createCorsHeaders(request)
  if (request.method !== 'POST') {
    return failureResponse(
      { code: 'VALIDATION_FAILED', message: '지원하지 않는 요청입니다.' },
      requestId,
      405,
      headers,
    )
  }

  if (!isAuthorized(request)) {
    return failureResponse(
      { code: 'ADMIN_FORBIDDEN', message: '갱신 권한이 없습니다.' },
      requestId,
      401,
      headers,
    )
  }

  try {
    const bestsellers = await fetchAladinBestsellers(readRequiredEnv('ALADIN_TTB_KEY'))
    await saveBestsellers(bestsellers)
    logOperationalEvent('info', 'bestseller_refresh_completed', { count: bestsellers.length, requestId })
    return successResponse({ count: bestsellers.length }, requestId, headers)
  } catch (error) {
    const isUpstreamError = error instanceof AladinBestsellerError || error instanceof z.ZodError
    logOperationalEvent('error', 'bestseller_refresh_failed', { requestId, retryable: isUpstreamError })
    return failureResponse(
      {
        code: isUpstreamError ? 'BOOK_SEARCH_FAILED' : 'INTERNAL_ERROR',
        message: '베스트셀러 목록을 갱신하지 못했어요.',
        retryable: isUpstreamError,
      },
      requestId,
      isUpstreamError ? 502 : 500,
      headers,
    )
  }
}

if (import.meta.main) Deno.serve(handleBestsellerRefresh)
