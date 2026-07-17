import { createRequestId, failureResponse } from '../_shared/api.ts'
import { readRequiredEnv } from '../_shared/env.ts'
import { logOperationalEvent } from '../_shared/logger.ts'
import {
  clearStateCookie,
  createSyntheticNaverEmail,
  fetchNaverProfile,
  NaverProfileRequestError,
  type NaverProfile,
  verifyStateCookie,
} from '../_shared/naver.ts'
import { consumeRequestRateLimit } from '../_shared/rate-limit.ts'
import { createAdminClient } from '../_shared/supabase.ts'

/** 인증 오류 코드를 callback URL에 담아 redirect 응답을 만든다. */
function redirectWithError(returnTo: string, code: string, cookie: string): Response {
  const url = new URL(returnTo)
  url.searchParams.set('auth_error', code)
  return new Response(null, {
    status: 302,
    headers: { location: url.toString(), 'set-cookie': cookie, 'cache-control': 'no-store' },
  })
}

/** Supabase 로그인 링크 데이터를 생성해 반환한다. */
async function createSupabaseLoginLink(
  subject: string,
  displayName: string,
  returnTo: string,
): Promise<string> {
  const admin = createAdminClient()
  const email = await createSyntheticNaverEmail(subject, readRequiredEnv('NAVER_IDENTITY_SECRET'))
  await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { provider: 'naver', display_name: displayName },
  })
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: returnTo },
  })
  if (error || !data.properties.action_link) throw new Error('Supabase login link generation failed')
  return data.properties.action_link
}

/** Naver OAuth callback 요청이나 사용자 동작을 처리한다. */
export async function handleNaverOauthCallback(request: Request): Promise<Response> {
  const requestId = createRequestId(request)
  if (request.method !== 'GET') {
    return failureResponse(
      { code: 'VALIDATION_FAILED', message: '지원하지 않는 요청입니다.' },
      requestId,
      405,
      { allow: 'GET' },
    )
  }

  const requestUrl = new URL(request.url)
  const state = requestUrl.searchParams.get('state') ?? ''
  const redirectUri = readRequiredEnv('NAVER_REDIRECT_URI')
  const secureCookie = new URL(redirectUri).protocol === 'https:'
  const clearCookie = clearStateCookie(secureCookie)
  const statePayload = await verifyStateCookie(
    request.headers.get('cookie'),
    state,
    readRequiredEnv('NAVER_STATE_SECRET'),
  )
  if (!statePayload) {
    return failureResponse(
      { code: 'AUTH_PROVIDER_FAILED', message: '로그인 요청이 만료되었거나 올바르지 않습니다.' },
      requestId,
      400,
      { 'set-cookie': clearCookie },
    )
  }

  let isAllowed = false
  try {
    isAllowed = await consumeRequestRateLimit(
      request,
      readRequiredEnv('AUTH_RATE_LIMIT_SECRET'),
      { bucket: 'naver-oauth-callback', limit: 30, windowSeconds: 600 },
    )
  } catch {
    logOperationalEvent('error', 'naver_oauth_failed', { requestId, retryable: true })
    return redirectWithError(statePayload.returnTo, 'provider_failed', clearCookie)
  }
  if (!isAllowed) return redirectWithError(statePayload.returnTo, 'rate_limited', clearCookie)

  if (requestUrl.searchParams.has('error')) {
    return redirectWithError(statePayload.returnTo, 'provider_denied', clearCookie)
  }

  const code = requestUrl.searchParams.get('code')
  if (!code) return redirectWithError(statePayload.returnTo, 'missing_code', clearCookie)

  let profile: NaverProfile
  try {
    profile = await fetchNaverProfile(code, state, {
      clientId: readRequiredEnv('NAVER_CLIENT_ID'),
      clientSecret: readRequiredEnv('NAVER_CLIENT_SECRET'),
      redirectUri,
    })
  } catch (error: unknown) {
    logOperationalEvent('error', 'naver_oauth_failed', { requestId, retryable: true })
    const errorCode = error instanceof NaverProfileRequestError
      ? `naver_${error.stage}_failed`
      : 'naver_profile_failed'
    return redirectWithError(statePayload.returnTo, errorCode, clearCookie)
  }

  try {
    const actionLink = await createSupabaseLoginLink(profile.subject, profile.displayName, statePayload.returnTo)
    logOperationalEvent('info', 'naver_oauth_succeeded', { requestId, status: 'redirected' })
    return new Response(null, {
      status: 302,
      headers: { location: actionLink, 'set-cookie': clearCookie, 'cache-control': 'no-store' },
    })
  } catch {
    logOperationalEvent('error', 'naver_oauth_failed', { requestId, retryable: true })
    return redirectWithError(statePayload.returnTo, 'provider_failed', clearCookie)
  }
}

if (import.meta.main) Deno.serve(handleNaverOauthCallback)
