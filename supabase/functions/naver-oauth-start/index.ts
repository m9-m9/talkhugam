import { createRequestId } from '../_shared/api.ts'
import { readRequiredEnv } from '../_shared/env.ts'
import { logOperationalEvent } from '../_shared/logger.ts'
import {
  createNaverAuthorizeUrl,
  createStateCookie,
  parseAllowedRedirects,
  selectReturnTo,
} from '../_shared/naver.ts'
import { consumeRequestRateLimit } from '../_shared/rate-limit.ts'

/** 허용하지 않는 HTTP method 요청에 405 응답을 반환한다. */
function methodNotAllowed(): Response {
  return new Response('Method Not Allowed', {
    status: 405,
    headers: { allow: 'GET' },
  })
}

/** Naver OAuth 시작 요청이나 사용자 동작을 처리한다. */
export async function handleNaverOauthStart(request: Request): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed()

  const requestId = createRequestId(request)
  let isAllowed = false
  try {
    isAllowed = await consumeRequestRateLimit(
      request,
      readRequiredEnv('AUTH_RATE_LIMIT_SECRET'),
      { bucket: 'naver-oauth-start', limit: 20, windowSeconds: 600 },
    )
  } catch {
    logOperationalEvent('error', 'naver_oauth_failed', { requestId, retryable: true })
    return new Response('Service Unavailable', { status: 503, headers: { 'cache-control': 'no-store' } })
  }
  if (!isAllowed) {
    return new Response('Too Many Requests', {
      status: 429,
      headers: { 'cache-control': 'no-store', 'retry-after': '600' },
    })
  }

  const requestUrl = new URL(request.url)
  const redirectUri = readRequiredEnv('NAVER_REDIRECT_URI')
  const allowed = parseAllowedRedirects(readRequiredEnv('ALLOWED_AUTH_REDIRECTS'))
  const returnTo = selectReturnTo(requestUrl.searchParams.get('return_to'), allowed)
  const state = crypto.randomUUID().replaceAll('-', '')
  const cookie = await createStateCookie(
    { state, returnTo, issuedAt: Math.floor(Date.now() / 1000) },
    readRequiredEnv('NAVER_STATE_SECRET'),
    new URL(redirectUri).protocol === 'https:',
  )
  const authorizeUrl = createNaverAuthorizeUrl(
    readRequiredEnv('NAVER_CLIENT_ID'),
    redirectUri,
    state,
  )

  return new Response(null, {
    status: 302,
    headers: {
      location: authorizeUrl.toString(),
      'set-cookie': cookie,
      'cache-control': 'no-store',
    },
  })
}

if (import.meta.main) Deno.serve(handleNaverOauthStart)
