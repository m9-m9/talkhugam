import { assertEquals } from 'jsr:@std/assert@1.0.14'
import { muxWebhookEventSchema, normalizeMuxEvent } from './schema.ts'

Deno.test('normalizeMuxEvent selects the signed playback id from ready assets', () => {
  const event = muxWebhookEventSchema.parse({
    id: 'event-ready',
    type: 'video.asset.ready',
    data: {
      id: 'asset-1',
      passthrough: crypto.randomUUID(),
      duration: 29.5,
      aspect_ratio: '9:16',
      playback_ids: [
        { id: 'public-id', policy: 'public' },
        { id: 'signed-id', policy: 'signed' },
      ],
    },
  })

  assertEquals(normalizeMuxEvent(event), {
    eventId: 'event-ready',
    eventType: 'video.asset.ready',
    objectId: 'asset-1',
    status: 'ready',
    muxAssetId: 'asset-1',
    playbackId: 'signed-id',
    durationSeconds: 29.5,
    aspectRatio: '9:16',
  })
})

Deno.test('normalizeMuxEvent rejects incomplete ready payloads', () => {
  const event = muxWebhookEventSchema.parse({
    id: 'event-incomplete',
    type: 'video.asset.ready',
    data: { id: 'asset-1', duration: 10, playback_ids: [] },
  })

  assertEquals(normalizeMuxEvent(event), null)
})

Deno.test('normalizeMuxEvent maps errored and deleted events without message contents', () => {
  const errored = muxWebhookEventSchema.parse({
    id: 'event-error',
    type: 'video.asset.errored',
    data: {
      id: 'asset-1',
      errors: { type: 'invalid_input', messages: ['raw upstream detail'] },
    },
  })
  const deleted = muxWebhookEventSchema.parse({
    id: 'event-deleted',
    type: 'video.asset.deleted',
    data: { id: 'asset-1' },
  })

  assertEquals(normalizeMuxEvent(errored)?.errorCode, 'invalid_input')
  assertEquals(normalizeMuxEvent(deleted)?.status, 'deleted')
})

Deno.test('normalizeMuxEvent ignores unrelated verified event types', () => {
  const event = muxWebhookEventSchema.parse({
    id: 'event-other',
    type: 'video.asset.static_renditions.ready',
    data: { id: 'asset-1' },
  })

  assertEquals(normalizeMuxEvent(event), null)
})
