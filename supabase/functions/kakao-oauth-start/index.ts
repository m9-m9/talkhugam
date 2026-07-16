import { createRequestId } from '../_shared/api.ts'
import { readRequiredEnv } from '../_shared/env.ts'
import { logOperationalEvent } from '../_shared/logger.ts'
import {
  createKakaoAuthorizeUrl,
  createStateCookie,
  parseAllowedRedirects,
  selectReturnTo,
} from '../_shared/kakao.ts'
import { consumeRequestRateLimit } from '../_shared/rate-limit.ts'

function methodNotAllowed(): Response {
  return new Response('Method Not Allowed', {
    status: 405,
    headers: { allow: 'GET' },
  })
}

export async function handleKakaoOauthStart(request: Request): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed()

  const requestId = createRequestId(request)
  let isAllowed = false
  try {
    isAllowed = await consumeRequestRateLimit(
      request,
      readRequiredEnv('AUTH_RATE_LIMIT_SECRET'),
      { bucket: 'kakao-oauth-start', limit: 20, windowSeconds: 600 },
    )
  } catch {
    logOperationalEvent('error', 'kakao_oauth_failed', { requestId, retryable: true })
    return new Response('Service Unavailable', { status: 503, headers: { 'cache-control': 'no-store' } })
  }
  if (!isAllowed) {
    return new Response('Too Many Requests', {
      status: 429,
      headers: { 'cache-control': 'no-store', 'retry-after': '600' },
    })
  }

  const requestUrl = new URL(request.url)
  const redirectUri = readRequiredEnv('KAKAO_REDIRECT_URI')
  const allowed = parseAllowedRedirects(readRequiredEnv('ALLOWED_AUTH_REDIRECTS'))
  const returnTo = selectReturnTo(requestUrl.searchParams.get('return_to'), allowed)
  const state = crypto.randomUUID().replaceAll('-', '')
  const cookie = await createStateCookie(
    { state, returnTo, issuedAt: Math.floor(Date.now() / 1000) },
    readRequiredEnv('KAKAO_STATE_SECRET'),
    new URL(redirectUri).protocol === 'https:',
  )
  const authorizeUrl = createKakaoAuthorizeUrl(
    readRequiredEnv('KAKAO_REST_API_KEY'),
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

if (import.meta.main) Deno.serve(handleKakaoOauthStart)
