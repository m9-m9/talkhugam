import { z } from 'npm:zod@4.4.3'
import { readRequiredEnv } from '../_shared/env.ts'
import { logOperationalEvent } from '../_shared/logger.ts'
import { verifyMuxWebhook } from '../_shared/mux.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { muxWebhookEventSchema, normalizeMuxEvent } from './schema.ts'

const postIdSchema = z.uuid()

async function resolvePostId(
  event: z.infer<typeof muxWebhookEventSchema>,
): Promise<string | null> {
  const passthrough = postIdSchema.safeParse(event.data.passthrough)
  if (passthrough.success) return passthrough.data

  const admin = createAdminClient()
  const column = event.type.startsWith('video.upload.') ? 'mux_upload_id' : 'mux_asset_id'
  const response = await admin
    .from('video_assets')
    .select('post_id')
    .eq(column, event.data.id)
    .maybeSingle()

  if (response.error) throw response.error
  return response.data?.post_id ?? null
}

export async function handleMuxWebhook(request: Request): Promise<Response> {
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  const rawBody = await request.text()
  const signature = request.headers.get('mux-signature') ?? ''
  const isVerified = await verifyMuxWebhook(
    rawBody,
    signature,
    readRequiredEnv('MUX_WEBHOOK_SECRET'),
  )
  if (!isVerified) return new Response('Invalid signature', { status: 401 })

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return new Response('Invalid payload', { status: 400 })
  }

  const parsed = muxWebhookEventSchema.safeParse(payload)
  if (!parsed.success) return new Response('Invalid payload', { status: 400 })

  const normalized = normalizeMuxEvent(parsed.data)
  if (!normalized) {
    return Response.json({ received: true, handled: false })
  }

  try {
    const postId = await resolvePostId(parsed.data)
    if (!postId) throw new Error('Video post not found')

    const admin = createAdminClient()
    const response = await admin.rpc('apply_mux_video_event', {
      p_event_id: normalized.eventId,
      p_event_type: normalized.eventType,
      p_post_id: postId,
      p_status: normalized.status,
      p_object_id: normalized.objectId,
      p_mux_asset_id: normalized.muxAssetId ?? null,
      p_playback_id: normalized.playbackId ?? null,
      p_duration_seconds: normalized.durationSeconds ?? null,
      p_aspect_ratio: normalized.aspectRatio ?? null,
      p_error_code: normalized.errorCode ?? null,
    })
    if (response.error) throw response.error

    return Response.json({ received: true, handled: true, applied: z.boolean().parse(response.data) })
  } catch {
    logOperationalEvent('error', 'mux_webhook_failed', {
      eventId: parsed.data.id,
      status: 'apply_failed',
      retryable: true,
    })
    return new Response('Webhook processing failed', { status: 500 })
  }
}

if (import.meta.main) Deno.serve(handleMuxWebhook)
