import { z } from 'zod'
import { createRequestId, failureResponse, successResponse } from '../_shared/api.ts'
import { parseJsonBody } from '../_shared/body.ts'
import { createCorsHeaders, optionsResponse } from '../_shared/cors.ts'
import { readRequiredEnv } from '../_shared/env.ts'
import { createAdminClient, getAuthenticatedContext } from '../_shared/supabase.ts'
import { fetchKakaoBooks, KakaoBookSearchError } from './kakao.ts'
import { bookSearchInputSchema } from './schema.ts'

async function consumeBookSearchLimit(userId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('consume_rate_limit', {
    p_bucket: 'book-search',
    p_subject: userId,
    p_limit: 30,
    p_window_seconds: 60,
  })

  if (error) throw error
  return z.boolean().parse(data)
}

function failureFromError(error: unknown, requestId: string, headers: HeadersInit): Response {
  if (error instanceof KakaoBookSearchError && error.upstreamStatus === 429) {
    return failureResponse(
      { code: 'RATE_LIMITED', message: '도서 검색 요청이 많습니다.', retryable: true },
      requestId,
      429,
      headers,
    )
  }

  if (error instanceof KakaoBookSearchError || error instanceof z.ZodError) {
    return failureResponse(
      { code: 'BOOK_SEARCH_FAILED', message: '도서 검색에 실패했습니다.', retryable: true },
      requestId,
      502,
      headers,
    )
  }

  return failureResponse(
    { code: 'INTERNAL_ERROR', message: '잠시 후 다시 시도해 주세요.', retryable: true },
    requestId,
    500,
    headers,
  )
}

export async function handleBookSearch(request: Request): Promise<Response> {
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

  const auth = await getAuthenticatedContext(request)
  if (!auth) {
    return failureResponse(
      { code: 'AUTH_REQUIRED', message: '로그인이 필요합니다.' },
      requestId,
      401,
      headers,
    )
  }

  const body = await parseJsonBody(request, bookSearchInputSchema)
  if (!body.ok) {
    const error = body.field
      ? { code: 'VALIDATION_FAILED' as const, message: '검색 조건을 확인해 주세요.', field: body.field }
      : { code: 'VALIDATION_FAILED' as const, message: '검색 조건을 확인해 주세요.' }

    return failureResponse(
      error,
      requestId,
      400,
      headers,
    )
  }

  try {
    const isAllowed = await consumeBookSearchLimit(auth.user.id)
    if (!isAllowed) {
      return failureResponse(
        { code: 'RATE_LIMITED', message: '잠시 후 다시 검색해 주세요.', retryable: true },
        requestId,
        429,
        headers,
      )
    }

    const result = await fetchKakaoBooks(body.value, readRequiredEnv('KAKAO_REST_API_KEY'))
    return successResponse(result, requestId, headers)
  } catch (error) {
    console.error(JSON.stringify({ function: 'book-search', requestId, error: 'request_failed' }))
    return failureFromError(error, requestId, headers)
  }
}

Deno.serve(handleBookSearch)
