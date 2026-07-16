import { assertEquals } from 'jsr:@std/assert@1.0.14'
import { withEnv } from './_test/env.ts'
import { handleKakaoOauthCallback } from './kakao-oauth-callback/index.ts'
import { handleKakaoOauthStart } from './kakao-oauth-start/index.ts'
import { handleNaverOauthCallback } from './naver-oauth-callback/index.ts'
import { handleNaverOauthStart } from './naver-oauth-start/index.ts'

Deno.test('Naver OAuth start only accepts browser navigation', async () => {
  const request = new Request('http://localhost/naver-oauth-start', { method: 'POST' })
  const response = await handleNaverOauthStart(request)

  assertEquals(response.status, 405)
  assertEquals(response.headers.get('allow'), 'GET')
})

Deno.test('Naver OAuth callback rejects a request without a signed state cookie', async () => {
  await withEnv(
    {
      NAVER_REDIRECT_URI: 'http://127.0.0.1:54321/functions/v1/naver-oauth-callback',
      NAVER_STATE_SECRET: 'state-secret',
    },
    async () => {
      const request = new Request('http://localhost/naver-oauth-callback?state=invalid')
      const response = await handleNaverOauthCallback(request)

      assertEquals(response.status, 400)
      assertEquals(response.headers.get('set-cookie')?.includes('Max-Age=0'), true)
      assertEquals((await response.json()).error.code, 'AUTH_PROVIDER_FAILED')
    },
  )
})

Deno.test('Kakao OAuth start only accepts browser navigation', async () => {
  const request = new Request('http://localhost/kakao-oauth-start', { method: 'POST' })
  const response = await handleKakaoOauthStart(request)

  assertEquals(response.status, 405)
  assertEquals(response.headers.get('allow'), 'GET')
})

Deno.test('Kakao OAuth callback rejects a request without a signed state cookie', async () => {
  await withEnv(
    {
      KAKAO_REDIRECT_URI: 'http://127.0.0.1:54321/functions/v1/kakao-oauth-callback',
      KAKAO_STATE_SECRET: 'state-secret',
    },
    async () => {
      const request = new Request('http://localhost/kakao-oauth-callback?state=invalid')
      const response = await handleKakaoOauthCallback(request)

      assertEquals(response.status, 400)
      assertEquals(response.headers.get('set-cookie')?.includes('Max-Age=0'), true)
      assertEquals((await response.json()).error.code, 'AUTH_PROVIDER_FAILED')
    },
  )
})
