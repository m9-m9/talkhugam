import { importPKCS8, SignJWT } from 'jose'
import { z } from 'zod'

const directUploadResponseSchema = z.object({
  data: z.object({
    id: z.string().min(1),
    url: z.url(),
  }),
})

const encoder = new TextEncoder()

export type DirectUpload = {
  id: string
  url: string
}

export type MuxCredentials = {
  tokenId: string
  tokenSecret: string
}

export class MuxApiError extends Error {
  constructor(public readonly status: number) {
    super(`Mux API request failed with status ${status}`)
    this.name = 'MuxApiError'
  }
}

function createBasicAuthorization(credentials: MuxCredentials): string {
  return `Basic ${btoa(`${credentials.tokenId}:${credentials.tokenSecret}`)}`
}

function decodeSigningPrivateKey(value: string): string {
  if (value.includes('BEGIN PRIVATE KEY')) return value.replaceAll('\\n', '\n')
  return new TextDecoder().decode(Uint8Array.from(atob(value), (character) => character.charCodeAt(0)))
}

function parseSignatureHeader(header: string): { timestamp: string; signatures: string[] } | null {
  const values = header.split(',').map((part) => part.trim().split('=', 2))
  const timestamp = values.find(([key]) => key === 't')?.[1]
  const signatures = values.filter(([key]) => key === 'v1').map(([, value]) => value ?? '')

  if (!timestamp || signatures.length === 0) return null
  return { timestamp, signatures }
}

function timingSafeEqual(left: string, right: string): boolean {
  const leftBytes = encoder.encode(left)
  const rightBytes = encoder.encode(right)
  if (leftBytes.length !== rightBytes.length) return false

  let difference = 0
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0)
  }
  return difference === 0
}

export async function createDirectUpload(
  credentials: MuxCredentials,
  input: { corsOrigin: string; postId: string },
  fetcher: typeof fetch = fetch,
): Promise<DirectUpload> {
  const response = await fetcher('https://api.mux.com/video/v1/uploads', {
    method: 'POST',
    headers: {
      Authorization: createBasicAuthorization(credentials),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      cors_origin: input.corsOrigin,
      new_asset_settings: {
        passthrough: input.postId,
        playback_policies: ['signed'],
        video_quality: 'basic',
      },
    }),
  })

  if (!response.ok) throw new MuxApiError(response.status)
  const parsed = directUploadResponseSchema.parse(await response.json())
  return parsed.data
}

export async function getDirectUpload(
  credentials: MuxCredentials,
  uploadId: string,
  fetcher: typeof fetch = fetch,
): Promise<DirectUpload> {
  const response = await fetcher(
    `https://api.mux.com/video/v1/uploads/${encodeURIComponent(uploadId)}`,
    { headers: { Authorization: createBasicAuthorization(credentials) } },
  )

  if (!response.ok) throw new MuxApiError(response.status)
  const parsed = directUploadResponseSchema.parse(await response.json())
  return parsed.data
}

export async function deleteDirectUpload(
  credentials: MuxCredentials,
  uploadId: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const response = await fetcher(
    `https://api.mux.com/video/v1/uploads/${encodeURIComponent(uploadId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: createBasicAuthorization(credentials) },
    },
  )

  if (!response.ok && response.status !== 404) throw new MuxApiError(response.status)
}

export async function deleteMuxAsset(
  credentials: MuxCredentials,
  assetId: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const response = await fetcher(`https://api.mux.com/video/v1/assets/${encodeURIComponent(assetId)}`, {
    method: 'DELETE',
    headers: { Authorization: createBasicAuthorization(credentials) },
  })

  if (!response.ok && response.status !== 404) throw new MuxApiError(response.status)
}

export async function verifyMuxWebhook(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = 300,
): Promise<boolean> {
  const parsed = parseSignatureHeader(signatureHeader)
  if (!parsed) return false

  const timestamp = Number(parsed.timestamp)
  if (!Number.isSafeInteger(timestamp)) return false
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${parsed.timestamp}.${rawBody}`),
  )
  const expected = Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')

  return parsed.signatures.some((candidate) => timingSafeEqual(candidate, expected))
}

export async function signPlaybackToken(
  playbackId: string,
  keyId: string,
  encodedPrivateKey: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  lifetimeSeconds = 300,
): Promise<string> {
  const privateKey = await importPKCS8(decodeSigningPrivateKey(encodedPrivateKey), 'RS256')

  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid: keyId, typ: 'JWT' })
    .setSubject(playbackId)
    .setAudience('v')
    .setIssuedAt(nowSeconds)
    .setExpirationTime(nowSeconds + lifetimeSeconds)
    .sign(privateKey)
}
