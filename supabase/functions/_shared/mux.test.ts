import {
  exportPKCS8,
  exportSPKI,
  generateKeyPair,
  importSPKI,
  jwtVerify,
} from 'npm:jose@6.2.3'
import { assert, assertEquals } from 'jsr:@std/assert@1.0.14'
import {
  createDirectUpload,
  signPlaybackToken,
  verifyMuxWebhook,
} from './mux.ts'

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

Deno.test('createDirectUpload requests signed basic-quality playback', async () => {
  let requestBody: unknown
  let authorization = ''
  const fetcher: typeof fetch = (input, init) => {
    assertEquals(String(input), 'https://api.mux.com/video/v1/uploads')
    authorization = new Headers(init?.headers).get('authorization') ?? ''
    requestBody = JSON.parse(String(init?.body))
    return Promise.resolve(new Response(JSON.stringify({
      data: { id: 'upload-1', url: 'https://storage.example.test/upload' },
    }), { status: 201 }))
  }

  const upload = await createDirectUpload(
    { tokenId: 'token-id', tokenSecret: 'token-secret' },
    { corsOrigin: 'https://talkhugam.example', postId: crypto.randomUUID() },
    fetcher,
  )

  assert(authorization.startsWith('Basic '))
  assertEquals(upload.id, 'upload-1')
  assertEquals(
    (requestBody as { new_asset_settings: { playback_policies: string[] } })
      .new_asset_settings.playback_policies,
    ['signed'],
  )
})

Deno.test('verifyMuxWebhook validates raw body HMAC and timestamp tolerance', async () => {
  const body = '{"type":"video.asset.ready"}'
  const now = 1_700_000_000
  const header = await createWebhookSignature(body, now, 'webhook-secret')

  assertEquals(await verifyMuxWebhook(body, header, 'webhook-secret', now), true)
  assertEquals(await verifyMuxWebhook(`${body} `, header, 'webhook-secret', now), false)
  assertEquals(await verifyMuxWebhook(body, header, 'webhook-secret', now + 301), false)
})

Deno.test('signPlaybackToken creates a short-lived Mux video JWT', async () => {
  const { privateKey, publicKey } = await generateKeyPair('RS256', { extractable: true })
  const privatePem = await exportPKCS8(privateKey)
  const publicPem = await exportSPKI(publicKey)
  const encodedPrivateKey = btoa(privatePem)
  const now = 1_700_000_000

  const token = await signPlaybackToken('playback-1', 'key-1', encodedPrivateKey, now, 300)
  const verificationKey = await importSPKI(publicPem, 'RS256')
  const { payload, protectedHeader } = await jwtVerify(token, verificationKey, {
    audience: 'v',
    currentDate: new Date(now * 1000),
  })

  assertEquals(payload.sub, 'playback-1')
  assertEquals(payload.exp, now + 300)
  assertEquals(protectedHeader.kid, 'key-1')
})

Deno.test('signPlaybackToken accepts a PEM value stored with escaped line breaks', async () => {
  const { privateKey, publicKey } = await generateKeyPair('RS256', { extractable: true })
  const privatePem = await exportPKCS8(privateKey)
  const publicPem = await exportSPKI(publicKey)
  const now = 1_700_000_000

  const token = await signPlaybackToken(
    'playback-1',
    'key-1',
    privatePem.replaceAll('\n', '\\n'),
    now,
    300,
  )
  const verificationKey = await importSPKI(publicPem, 'RS256')
  const { payload } = await jwtVerify(token, verificationKey, {
    audience: 'v',
    currentDate: new Date(now * 1000),
  })

  assertEquals(payload.sub, 'playback-1')
})
