import { z } from 'npm:zod@4.4.3'

const playbackIdSchema = z.object({
  id: z.string().min(1),
  policy: z.string().optional(),
})

export const muxWebhookEventSchema = z.object({
  id: z.string().min(1).max(200),
  type: z.string().min(1).max(200),
  data: z.object({
    id: z.string().min(1),
    asset_id: z.string().min(1).nullish(),
    passthrough: z.string().nullish(),
    duration: z.number().nonnegative().nullish(),
    aspect_ratio: z.string().nullish(),
    playback_ids: z.array(playbackIdSchema).nullish(),
    errors: z.object({
      type: z.string().nullish(),
      messages: z.array(z.string()).nullish(),
    }).nullish(),
  }).passthrough(),
})

export type MuxWebhookEvent = z.infer<typeof muxWebhookEventSchema>

export type NormalizedMuxEvent = {
  eventId: string
  eventType: string
  objectId: string
  status: 'processing' | 'ready' | 'failed' | 'deleted'
  muxAssetId?: string
  playbackId?: string
  durationSeconds?: number
  aspectRatio?: string
  errorCode?: string
}

export function normalizeMuxEvent(event: MuxWebhookEvent): NormalizedMuxEvent | null {
  const base = {
    eventId: event.id,
    eventType: event.type,
    objectId: event.data.id,
  }

  if (event.type === 'video.upload.asset_created' && event.data.asset_id) {
    return { ...base, status: 'processing', muxAssetId: event.data.asset_id }
  }

  if (event.type === 'video.asset.ready') {
    const playbackId = event.data.playback_ids?.find((item) => item.policy === 'signed')?.id
      ?? event.data.playback_ids?.[0]?.id
    if (!playbackId || event.data.duration == null) return null

    return {
      ...base,
      status: 'ready',
      muxAssetId: event.data.id,
      playbackId,
      durationSeconds: event.data.duration,
      ...(event.data.aspect_ratio ? { aspectRatio: event.data.aspect_ratio } : {}),
    }
  }

  if (event.type === 'video.asset.errored') {
    return {
      ...base,
      status: 'failed',
      muxAssetId: event.data.id,
      errorCode: event.data.errors?.type ?? 'VIDEO_PROCESSING_FAILED',
    }
  }

  if (event.type === 'video.asset.deleted') {
    return { ...base, status: 'deleted', muxAssetId: event.data.id }
  }

  return null
}
