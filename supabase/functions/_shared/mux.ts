import { importPKCS8, SignJWT } from 'npm:jose@6.2.3'
import { z } from 'npm:zod@4.4.3'

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
  const normalized = value.trim().replaceAll('\\n', '\n')
  if (normalized.includes('BEGIN')) return normalizeSigningPem(normalized)

  const decoded = decodeBase64Pem(normalized)
  if (decoded.includes('BEGIN')) return normalizeSigningPem(decoded)

  const twiceDecoded = decodeBase64Pem(decoded)
  if (!twiceDecoded.includes('BEGIN')) throw new Error('Mux signing key is not a PEM value')
  return normalizeSigningPem(twiceDecoded)
}

function normalizeSigningPem(pem: string): string {
  if (pem.includes('BEGIN RSA PRIVATE KEY')) return convertPkcs1PemToPkcs8(pem)
  return pem
}

function decodeBase64Pem(value: string): string {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/')
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  return new TextDecoder().decode(
    Uint8Array.from(atob(`${base64}${padding}`), (character) => character.charCodeAt(0)),
  )
}

function convertPkcs1PemToPkcs8(pem: string): string {
  const pkcs1 = decodePem(pem)
  const algorithmIdentifier = new Uint8Array([
    0x30,
    0x0d,
    0x06,
    0x09,
    0x2a,
    0x86,
    0x48,
    0x86,
    0xf7,
    0x0d,
    0x01,
    0x01,
    0x01,
    0x05,
    0x00,
  ])
  const version = new Uint8Array([0x02, 0x01, 0x00])
  const octetString = encodeDerValue(0x04, pkcs1)
  const content = concatenateBytes(version, algorithmIdentifier, octetString)
  return encodePem('PRIVATE KEY', encodeDerValue(0x30, content))
}

function decodePem(pem: string): Uint8Array {
  const body = pem.replace(/-----BEGIN [A-Z ]+-----|-----END [A-Z ]+-----|\s/g, '')
  return Uint8Array.from(atob(body), (character) => character.charCodeAt(0))
}

function encodeDerValue(tag: number, value: Uint8Array): Uint8Array {
  return concatenateBytes(new Uint8Array([tag]), encodeDerLength(value.length), value)
}

function encodeDerLength(length: number): Uint8Array {
  if (length < 128) return new Uint8Array([length])

  const bytes: number[] = []
  let remaining = length
  while (remaining > 0) {
    bytes.unshift(remaining & 0xff)
    remaining >>= 8
  }
  return new Uint8Array([0x80 | bytes.length, ...bytes])
}

function concatenateBytes(...values: Uint8Array[]): Uint8Array {
  const length = values.reduce((total, value) => total + value.length, 0)
  const result = new Uint8Array(length)
  let offset = 0
  for (const value of values) {
    result.set(value, offset)
    offset += value.length
  }
  return result
}

function encodePem(label: string, value: Uint8Array): string {
  const binary = Array.from(value, (byte) => String.fromCharCode(byte)).join('')
  const base64 = btoa(binary).match(/.{1,64}/g)?.join('\n') ?? ''
  return `-----BEGIN ${label}-----\n${base64}\n-----END ${label}-----`
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
  audience: 't' | 'v' = 'v',
): Promise<string> {
  const privateKey = await importPKCS8(decodeSigningPrivateKey(encodedPrivateKey), 'RS256')

  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid: keyId, typ: 'JWT' })
    .setSubject(playbackId)
    .setAudience(audience)
    .setIssuedAt(nowSeconds)
    .setExpirationTime(nowSeconds + lifetimeSeconds)
    .sign(privateKey)
}
