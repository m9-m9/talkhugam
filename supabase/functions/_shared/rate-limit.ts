import { z } from 'npm:zod@4.4.3'
import { createHmacSha256 } from './secret.ts'
import { createAdminClient } from './supabase.ts'

type RateLimitInput = {
  bucket: string
  subject: string
  limit: number
  windowSeconds: number
}

function encodeHex(value: Uint8Array): string {
  return Array.from(value, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function readClientAddress(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const address = request.headers.get('cf-connecting-ip')?.trim() || forwarded || 'unknown'
  return address.slice(0, 200)
}

export async function createRequestFingerprint(request: Request, secret: string): Promise<string> {
  const digest = await createHmacSha256(`client:${readClientAddress(request)}`, secret)
  return encodeHex(digest)
}

export async function consumeRateLimit(input: RateLimitInput): Promise<boolean> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('consume_rate_limit', {
    p_bucket: input.bucket,
    p_subject: input.subject,
    p_limit: input.limit,
    p_window_seconds: input.windowSeconds,
  })
  if (error) throw error
  return z.boolean().parse(data)
}

export async function consumeRequestRateLimit(
  request: Request,
  secret: string,
  input: Omit<RateLimitInput, 'subject'>,
): Promise<boolean> {
  const subject = await createRequestFingerprint(request, secret)
  return consumeRateLimit({ ...input, subject })
}
