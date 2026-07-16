import { assert, assertEquals, assertNotEquals } from 'jsr:@std/assert@1.0.19'

import {
  createKakaoAuthorizeUrl,
  createStateCookie,
  createSyntheticKakaoEmail,
  fetchKakaoProfile,
  verifyStateCookie,
} from './kakao.ts'

const STATE = '12345678901234567890123456789012'
const RETURN_TO = 'http://127.0.0.1:3000/auth/callback'

Deno.test('Kakao authorize URL only requests the profile data used by Talk후감', () => {
  const url = createKakaoAuthorizeUrl('rest-api-key', 'https://api.example/callback', STATE)

  assertEquals(url.origin, 'https://kauth.kakao.com')
  assertEquals(url.searchParams.get('client_id'), 'rest-api-key')
  assertEquals(url.searchParams.get('redirect_uri'), 'https://api.example/callback')
  assertEquals(url.searchParams.get('state'), STATE)
  assertEquals(url.searchParams.get('scope'), 'profile_nickname profile_image')
  assertEquals(url.searchParams.has('account_email'), false)
})

Deno.test('Kakao state cookie rejects tampering and expiry', async () => {
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

Deno.test('Kakao subject creates a stable internal login email', async () => {
  const first = await createSyntheticKakaoEmail('12345', 'identity-secret')
  const second = await createSyntheticKakaoEmail('12345', 'identity-secret')
  const other = await createSyntheticKakaoEmail('67890', 'identity-secret')

  assertEquals(first, second)
  assertNotEquals(first, other)
  assert(first.endsWith('@oauth.talkhugam.invalid'))
  assertEquals(first.includes('12345'), false)
})

Deno.test('Kakao profile exchange keeps the client secret out of the request URL', async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = []
  const fetcher: typeof fetch = (input, init) => {
    const url = String(input)
    requests.push({ url, ...(init ? { init } : {}) })
    if (requests.length === 1) {
      return Promise.resolve(Response.json({ access_token: 'access', token_type: 'Bearer' }))
    }
    return Promise.resolve(Response.json({ id: 12345, kakao_account: { profile: { nickname: '민구' } } }))
  }

  const profile = await fetchKakaoProfile(
    'authorization-code',
    {
      clientId: 'rest-api-key',
      clientSecret: 'client-secret',
      redirectUri: 'https://api.example/callback',
    },
    fetcher,
  )

  assertEquals(profile, { subject: '12345', displayName: '민구' })
  assertEquals(requests[0]?.url.includes('client-secret'), false)
  assert(String(requests[0]?.init?.body).includes('client_secret=client-secret'))
  assertEquals(new Headers(requests[1]?.init?.headers).get('authorization'), 'Bearer access')
})
