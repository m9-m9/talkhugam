import { z } from 'npm:zod@4.4.3'
import { createHmacSha256, secureEqual } from './secret.ts'

const NAVER_AUTHORIZE_ENDPOINT = 'https://nid.naver.com/oauth2.0/authorize'
const NAVER_TOKEN_ENDPOINT = 'https://nid.naver.com/oauth2.0/token'
const NAVER_PROFILE_ENDPOINT = 'https://openapi.naver.com/v1/nid/me'
const STATE_MAX_AGE_SECONDS = 600
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
  expires_in: z.string().optional(),
})

const profileResponseSchema = z.object({
  resultcode: z.literal('00'),
  response: z.object({
    id: z.string().min(1).max(255),
    nickname: z.string().trim().min(1).max(30).optional(),
    name: z.string().trim().min(1).max(30).optional(),
  }),
})

export type NaverProfile = {
  subject: string
  displayName: string
}

export type NaverProfileFailureStage = 'token' | 'profile'

export class NaverProfileRequestError extends Error {
  /** 전달받은 값으로 클래스 인스턴스의 초기 상태를 구성한다. */
  constructor(readonly stage: NaverProfileFailureStage) {
    super(`Naver ${stage} request failed`)
  }
}

type NaverCredentials = {
  clientId: string
  clientSecret: string
  redirectUri: string
}

type StatePayload = z.infer<typeof statePayloadSchema>

/** 바이트 배열을 URL-safe Base64 문자열로 인코딩한다. */
function encodeBase64Url(value: Uint8Array): string {
  const binary = Array.from(value, (byte) => String.fromCharCode(byte)).join('')
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

/** Base64 URL 문자열을 원본 바이트 배열로 복원한다. */
function decodeBase64Url(value: string): Uint8Array {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0))
}

/** sign에 필요한 암호학적 서명을 생성한다. */
async function sign(value: string, secret: string): Promise<string> {
  return encodeBase64Url(await createHmacSha256(value, secret))
}

/** 외부 입력을 검증해 허용된 Redirects 형식으로 변환한다. */
export function parseAllowedRedirects(rawRedirects: string): readonly string[] {
  const redirects = rawRedirects.split(',').map((value) => value.trim()).filter(Boolean)
  if (!redirects.length) throw new Error('At least one auth redirect must be configured')
  redirects.forEach((value) => new URL(value))
  return redirects
}

/** 허용 목록 안에서 OAuth 완료 후 복귀할 URL을 선택한다. */
export function selectReturnTo(requested: string | null, allowed: readonly string[]): string {
  if (!allowed.length) throw new Error('At least one auth redirect must be configured')
  return requested && allowed.includes(requested) ? requested : allowed[0] as string
}

/** Naver OAuth 인증 요청에 사용할 authorize URL을 만든다. */
export function createNaverAuthorizeUrl(clientId: string, redirectUri: string, state: string): URL {
  const url = new URL(NAVER_AUTHORIZE_ENDPOINT)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', state)
  return url
}

/** OAuth 요청 위조를 막는 서명된 state cookie를 만든다. */
export async function createStateCookie(
  payload: StatePayload,
  secret: string,
  secure: boolean,
): Promise<string> {
  const encodedPayload = encodeBase64Url(encoder.encode(JSON.stringify(payload)))
  const signature = await sign(encodedPayload, secret)
  const secureAttribute = secure ? '; Secure' : ''
  return `talkhugam_naver_state=${encodedPayload}.${signature}; Max-Age=${STATE_MAX_AGE_SECONDS}; Path=/functions/v1/naver-oauth-callback; HttpOnly; SameSite=Lax${secureAttribute}`
}

/** Cookie header에서 지정한 이름의 값을 찾아 반환한다. */
function readCookieValue(cookieHeader: string | null, name: string): string | null {
  const cookie = cookieHeader?.split(';').map((value) => value.trim())
    .find((value) => value.startsWith(`${name}=`))
  return cookie?.slice(name.length + 1) ?? null
}

/** 상태 Cookie의 유효성과 무결성을 검증한다. */
export async function verifyStateCookie(
  cookieHeader: string | null,
  expectedState: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<StatePayload | null> {
  try {
    const cookie = readCookieValue(cookieHeader, 'talkhugam_naver_state')
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

/** Naver OAuth state cookie를 즉시 만료시키는 응답 값을 만든다. */
export function clearStateCookie(secure: boolean): string {
  const secureAttribute = secure ? '; Secure' : ''
  return `talkhugam_naver_state=; Max-Age=0; Path=/functions/v1/naver-oauth-callback; HttpOnly; SameSite=Lax${secureAttribute}`
}

/** 외부 서비스에 Naver 프로필 데이터를 요청해 반환한다. */
export async function fetchNaverProfile(
  code: string,
  state: string,
  credentials: NaverCredentials,
  fetcher: typeof fetch = fetch,
): Promise<NaverProfile> {
  const tokenParameters = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    code,
    state,
  })
  const tokenResponse = await fetcher(NAVER_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: tokenParameters,
  })
  if (!tokenResponse.ok) throw new NaverProfileRequestError('token')
  let token: z.infer<typeof tokenResponseSchema>
  try {
    token = tokenResponseSchema.parse(await tokenResponse.json())
  } catch {
    throw new NaverProfileRequestError('token')
  }
  const profileResponse = await fetcher(NAVER_PROFILE_ENDPOINT, {
    headers: { authorization: `${token.token_type} ${token.access_token}` },
  })
  if (!profileResponse.ok) throw new NaverProfileRequestError('profile')
  let profile: z.infer<typeof profileResponseSchema>['response']
  try {
    profile = profileResponseSchema.parse(await profileResponse.json()).response
  } catch {
    throw new NaverProfileRequestError('profile')
  }

  return {
    subject: profile.id,
    displayName: profile.nickname ?? profile.name ?? 'Talk후감 사용자',
  }
}

/** 이메일이 없는 Naver 계정용 내부 대체 이메일을 만든다. */
export async function createSyntheticNaverEmail(subject: string, secret: string): Promise<string> {
  const subjectHash = await sign(`naver:${subject}`, secret)
  return `naver-${subjectHash.toLowerCase()}@oauth.talkhugam.invalid`
}
