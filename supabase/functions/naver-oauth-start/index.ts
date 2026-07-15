import { readRequiredEnv } from '../_shared/env.ts'
import {
  createNaverAuthorizeUrl,
  createStateCookie,
  parseAllowedRedirects,
  selectReturnTo,
} from '../_shared/naver.ts'

function methodNotAllowed(): Response {
  return new Response('Method Not Allowed', {
    status: 405,
    headers: { allow: 'GET' },
  })
}

export async function handleNaverOauthStart(request: Request): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed()

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
