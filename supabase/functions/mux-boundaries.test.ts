import { assertEquals } from 'jsr:@std/assert@1.0.14'
import { handleDeletionWorker } from './deletion-worker/index.ts'
import { handleMuxCreateUpload } from './mux-create-upload/index.ts'
import { handleMuxPlaybackToken } from './mux-playback-token/index.ts'
import { handleMuxThumbnailTokens } from './mux-thumbnail-tokens/index.ts'
import { handleMuxWebhook } from './mux-webhook/index.ts'
import { withEnv } from './_test/env.ts'
import { createJsonRequest } from './_test/request.ts'

async function createWebhookSignature(body: string, timestamp: number, secret: string): Promise<string> {
  const encoder = new TextEncoder()
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
    encoder.encode(`${timestamp}.${body}`),
  )
  const hex = Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
  return `t=${timestamp},v1=${hex}`
}

Deno.test('mux upload and media authorization handlers require a user session', async () => {
  await withEnv({ ALLOWED_ORIGINS: 'https://talkhugam.test' }, async () => {
    const uploadRequest = createJsonRequest('mux-create-upload', {}, {
      headers: { origin: 'https://talkhugam.test' },
    })
    const playbackRequest = createJsonRequest('mux-playback-token', {})
    const thumbnailRequest = createJsonRequest('mux-thumbnail-tokens', {})

    assertEquals((await handleMuxCreateUpload(uploadRequest)).status, 401)
    assertEquals((await handleMuxPlaybackToken(playbackRequest)).status, 401)
    assertEquals((await handleMuxThumbnailTokens(thumbnailRequest)).status, 401)
  })
})

Deno.test('mux upload rejects an origin outside the allowlist before auth', async () => {
  await withEnv({ ALLOWED_ORIGINS: 'https://talkhugam.test' }, async () => {
    const request = createJsonRequest('mux-create-upload', {}, {
      headers: { origin: 'https://evil.test' },
    })

    assertEquals((await handleMuxCreateUpload(request)).status, 403)
  })
})

Deno.test('mux webhook rejects an invalid signature', async () => {
  await withEnv({ MUX_WEBHOOK_SECRET: 'webhook-secret' }, async () => {
    const request = new Request('http://localhost/mux-webhook', {
      method: 'POST',
      headers: { 'mux-signature': 't=1,v1=invalid' },
      body: '{"id":"event-1"}',
    })

    assertEquals((await handleMuxWebhook(request)).status, 401)
  })
})

Deno.test('mux webhook acknowledges a signed but unrelated event', async () => {
  await withEnv({ MUX_WEBHOOK_SECRET: 'webhook-secret' }, async () => {
    const body = JSON.stringify({
      id: 'event-other',
      type: 'video.asset.static_renditions.ready',
      data: { id: 'asset-1' },
    })
    const timestamp = Math.floor(Date.now() / 1000)
    const signature = await createWebhookSignature(body, timestamp, 'webhook-secret')
    const request = new Request('http://localhost/mux-webhook', {
      method: 'POST',
      headers: { 'mux-signature': signature },
      body,
    })
    const response = await handleMuxWebhook(request)

    assertEquals(response.status, 200)
    assertEquals(await response.json(), { received: true, handled: false })
  })
})

Deno.test('deletion worker requires the named worker secret', async () => {
  await withEnv({ DELETION_WORKER_SECRET: 'worker-secret' }, async () => {
    const request = new Request('http://localhost/deletion-worker', {
      method: 'POST',
      headers: { authorization: 'Bearer wrong-secret' },
    })

    assertEquals((await handleDeletionWorker(request)).status, 401)
  })
})
