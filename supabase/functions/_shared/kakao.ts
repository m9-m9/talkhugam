import { z } from 'zod'

import { createHmacSha256, secureEqual } from './secret.ts'

const KAKAO_AUTHORIZE_ENDPOINT = 'https://kauth.kakao.com/oauth/authorize'
const KAKAO_TOKEN_ENDPOINT = 'https://kauth.kakao.com/oauth/token'
const KAKAO_PROFILE_ENDPOINT = 'https://kapi.kakao.com/v2/user/me'
const STATE_MAX_AGE_SECONDS = 600
const STATE_COOKIE_NAME = 'talkhugam_kakao_state'
const STATE_COOKIE_PATH = '/functions/v1/kakao-oauth-callback'
const encoder = new TextEncoder()
const decoder = new TextDecoder()

const statePayloadSchema = z.object({
  state: z.string().min(32).max(200),
  returnTo: z.string().url(),
  issuedAt: z.number().int().nonnegative(),
})

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().min(1),
})

const profileResponseSchema = z.object({
  id: z.union([z.string(), z.number()]),
  kakao_account: z.object({
    profile: z.object({
      nickname: z.string().trim().min(1).max(30).optional(),
    }).optional(),
  }).optional(),
})

export type KakaoProfile = {
  subject: string
  displayName: string
}

type KakaoCredentials = {
  clientId: string
  clientSecret: string
  redirectUri: string
}

type StatePayload = z.infer<typeof statePayloadSchema>

function encodeBase64Url(value: Uint8Array): string {
  const binary = Array.from(value, (byte) => String.fromCharCode(byte)).join('')
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function decodeBase64Url(value: string): Uint8Array {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0))
}

async function sign(value: string, secret: string): Promise<string> {
  return encodeBase64Url(await createHmacSha256(value, secret))
}

function readCookieValue(cookieHeader: string | null): string | null {
  const cookie = cookieHeader?.split(';').map((value) => value.trim())
    .find((value) => value.startsWith(`${STATE_COOKIE_NAME}=`))
  return cookie?.slice(STATE_COOKIE_NAME.length + 1) ?? null
}

export function parseAllowedRedirects(rawRedirects: string): readonly string[] {
  const redirects = rawRedirects.split(',').map((value) => value.trim()).filter(Boolean)
  if (!redirects.length) throw new Error('At least one auth redirect must be configured')
  redirects.forEach((value) => new URL(value))
  return redirects
}

export function selectReturnTo(requested: string | null, allowed: readonly string[]): string {
  if (!allowed.length) throw new Error('At least one auth redirect must be configured')
  return requested && allowed.includes(requested) ? requested : allowed[0] as string
}

export function createKakaoAuthorizeUrl(clientId: string, redirectUri: string, state: string): URL {
  const url = new URL(KAKAO_AUTHORIZE_ENDPOINT)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', state)
  url.searchParams.set('scope', 'profile_nickname profile_image')
  return url
}

export async function createStateCookie(
  payload: StatePayload,
  secret: string,
  secure: boolean,
): Promise<string> {
  const encodedPayload = encodeBase64Url(encoder.encode(JSON.stringify(payload)))
  const signature = await sign(encodedPayload, secret)
  const secureAttribute = secure ? '; Secure' : ''
  return `${STATE_COOKIE_NAME}=${encodedPayload}.${signature}; Max-Age=${STATE_MAX_AGE_SECONDS}; Path=${STATE_COOKIE_PATH}; HttpOnly; SameSite=Lax${secureAttribute}`
}

export async function verifyStateCookie(
  cookieHeader: string | null,
  expectedState: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<StatePayload | null> {
  try {
    const cookie = readCookieValue(cookieHeader)
    const [encodedPayload, providedSignature] = cookie?.split('.') ?? []
    if (!encodedPayload || !providedSignature) return null
    const expectedSignature = await sign(encodedPayload, secret)
    if (!secureEqual(providedSignature, expectedSignature)) return null
    const payload = statePayloadSchema.parse(JSON.parse(decoder.decode(decodeBase64Url(encodedPayload))))
    if (!secureEqual(payload.state, expectedState)) return null
    if (payload.issuedAt > nowSeconds || nowSeconds - payload.issuedAt > STATE_MAX_AGE_SECONDS) return null
    return payload
  } catch {
    return null
  }
}

export function clearStateCookie(secure: boolean): string {
  const secureAttribute = secure ? '; Secure' : ''
  return `${STATE_COOKIE_NAME}=; Max-Age=0; Path=${STATE_COOKIE_PATH}; HttpOnly; SameSite=Lax${secureAttribute}`
}

export async function fetchKakaoProfile(
  code: string,
  credentials: KakaoCredentials,
  fetcher: typeof fetch = fetch,
): Promise<KakaoProfile> {
  const tokenParameters = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    redirect_uri: credentials.redirectUri,
    code,
  })
  const tokenResponse = await fetcher(KAKAO_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: tokenParameters,
  })
  if (!tokenResponse.ok) throw new Error('Kakao token exchange failed')
  const token = tokenResponseSchema.parse(await tokenResponse.json())
  const profileResponse = await fetcher(KAKAO_PROFILE_ENDPOINT, {
    headers: { authorization: `${token.token_type} ${token.access_token}` },
  })
  if (!profileResponse.ok) throw new Error('Kakao profile request failed')
  const profile = profileResponseSchema.parse(await profileResponse.json())

  return {
    subject: String(profile.id),
    displayName: profile.kakao_account?.profile?.nickname ?? 'Talk후감 사용자',
  }
}

export async function createSyntheticKakaoEmail(subject: string, secret: string): Promise<string> {
  const subjectHash = await sign(`kakao:${subject}`, secret)
  return `kakao-${subjectHash.toLowerCase()}@oauth.talkhugam.invalid`
}
