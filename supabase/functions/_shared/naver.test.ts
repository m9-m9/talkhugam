import { assert, assertEquals, assertNotEquals, assertRejects } from 'jsr:@std/assert@1.0.19'
import {
  createNaverAuthorizeUrl,
  createStateCookie,
  createSyntheticNaverEmail,
  fetchNaverProfile,
  NaverProfileRequestError,
  parseAllowedRedirects,
  selectReturnTo,
  verifyStateCookie,
} from './naver.ts'

const STATE = '12345678901234567890123456789012'
const RETURN_TO = 'http://127.0.0.1:3000/auth/callback'

Deno.test('Naver authorize URL contains callback and unguessable state', () => {
  const url = createNaverAuthorizeUrl('client-id', 'https://api.example/callback', STATE)
  assertEquals(url.origin, 'https://nid.naver.com')
  assertEquals(url.searchParams.get('client_id'), 'client-id')
  assertEquals(url.searchParams.get('redirect_uri'), 'https://api.example/callback')
  assertEquals(url.searchParams.get('state'), STATE)
})

Deno.test('Naver state cookie rejects tampering and expiry', async () => {
  const cookie = await createStateCookie(
    { state: STATE, returnTo: RETURN_TO, issuedAt: 1_000 },
    'state-secret',
    true,
  )
  const cookieHeader = cookie.split(';')[0] ?? ''

  assertEquals(
    await verifyStateCookie(cookieHeader, STATE, 'state-secret', 1_300),
    { state: STATE, returnTo: RETURN_TO, issuedAt: 1_000 },
  )
  assertEquals(await verifyStateCookie(`${cookieHeader}x`, STATE, 'state-secret', 1_300), null)
  assertEquals(await verifyStateCookie(cookieHeader, `${STATE}x`, 'state-secret', 1_300), null)
  assertEquals(await verifyStateCookie(cookieHeader, STATE, 'state-secret', 1_601), null)
})

Deno.test('Naver return URL must exactly match the configured allowlist', () => {
  const allowed = parseAllowedRedirects(`${RETURN_TO}, https://talkhugam.example/auth/callback`)
  assertEquals(selectReturnTo('https://attacker.example/callback', allowed), RETURN_TO)
  assertEquals(selectReturnTo('https://talkhugam.example/auth/callback', allowed), allowed[1])
})

Deno.test('Naver subject creates a stable non-provider login email', async () => {
  const first = await createSyntheticNaverEmail('naver-subject', 'identity-secret')
  const second = await createSyntheticNaverEmail('naver-subject', 'identity-secret')
  const other = await createSyntheticNaverEmail('other-subject', 'identity-secret')

  assertEquals(first, second)
  assertNotEquals(first, other)
  assert(first.endsWith('@oauth.talkhugam.invalid'))
  assertEquals(first.includes('naver-subject'), false)
})

Deno.test('Naver profile exchange keeps the client secret out of the request URL', async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = []
  const fetcher: typeof fetch = (input, init) => {
    const url = String(input)
    requests.push({ url, ...(init ? { init } : {}) })
    if (requests.length === 1) {
      return Promise.resolve(Response.json({ access_token: 'access', token_type: 'Bearer' }))
    }
    return Promise.resolve(Response.json({
      resultcode: '00',
      response: { id: 'subject-1', nickname: '민구' },
    }))
  }

  const profile = await fetchNaverProfile(
    'authorization-code',
    STATE,
    {
      clientId: 'client-id',
      clientSecret: 'client-secret',
      redirectUri: 'https://api.example/callback',
    },
    fetcher,
  )

  assertEquals(profile, { subject: 'subject-1', displayName: '민구' })
  assertEquals(requests[0]?.url.includes('client-secret'), false)
  assert(String(requests[0]?.init?.body).includes('client_secret=client-secret'))
  assertEquals(new Headers(requests[1]?.init?.headers).get('authorization'), 'Bearer access')
})

Deno.test('Naver profile exchange identifies a token request failure', async () => {
  const fetcher: typeof fetch = () => Promise.resolve(new Response(null, { status: 401 }))

  const error = await assertRejects(
    () => fetchNaverProfile('authorization-code', STATE, {
      clientId: 'client-id',
      clientSecret: 'client-secret',
      redirectUri: 'https://api.example/callback',
    }, fetcher),
    NaverProfileRequestError,
  )

  assertEquals(error.stage, 'token')
})
