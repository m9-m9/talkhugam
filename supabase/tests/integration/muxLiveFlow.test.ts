import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { assert, assertEquals } from 'jsr:@std/assert@1.0.14'
import { z } from 'zod'

const configSchema = z.object({
  RUN_MUX_INTEGRATION_TESTS: z.literal('true'),
  SUPABASE_URL: z.url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
  TEST_USER_PASSWORD: z.string().min(8),
  TEST_MUX_VIDEO_URL: z.url(),
  TEST_ORIGIN: z.url(),
  DELETION_WORKER_SECRET: z.string().min(16),
})

const roomResultSchema = z.array(z.object({ room_id: z.uuid() }))
const chatResultSchema = z.array(z.object({ book_chat_id: z.uuid() }))
const uploadResultSchema = z.object({
  ok: z.literal(true),
  data: z.object({ postId: z.uuid(), uploadId: z.string().min(1), uploadUrl: z.url() }),
})
const playbackResultSchema = z.object({
  ok: z.literal(true),
  data: z.object({ playbackId: z.string().min(1), token: z.string().min(1), expiresAt: z.number() }),
})
const videoAssetSchema = z.object({
  status: z.enum(['waiting_upload', 'processing', 'ready', 'failed']),
  duration_seconds: z.number().nullable(),
  error_code: z.string().nullable(),
})

type TestConfig = z.infer<typeof configSchema>

function readConfig(): TestConfig | null {
  if (Deno.env.get('RUN_MUX_INTEGRATION_TESTS') !== 'true') return null
  return configSchema.parse({
    RUN_MUX_INTEGRATION_TESTS: Deno.env.get('RUN_MUX_INTEGRATION_TESTS'),
    SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
    SUPABASE_PUBLISHABLE_KEY: Deno.env.get('SUPABASE_PUBLISHABLE_KEY'),
    SUPABASE_SECRET_KEY: Deno.env.get('SUPABASE_SECRET_KEY'),
    TEST_USER_PASSWORD: Deno.env.get('TEST_USER_PASSWORD'),
    TEST_MUX_VIDEO_URL: Deno.env.get('TEST_MUX_VIDEO_URL'),
    TEST_ORIGIN: Deno.env.get('TEST_ORIGIN'),
    DELETION_WORKER_SECRET: Deno.env.get('DELETION_WORKER_SECRET'),
  })
}

function createAdmin(config: TestConfig): SupabaseClient {
  return createClient(config.SUPABASE_URL, config.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function createUser(admin: SupabaseClient, config: TestConfig): Promise<User> {
  const { data, error } = await admin.auth.admin.createUser({
    email: `mux-${crypto.randomUUID()}@test.local`,
    password: config.TEST_USER_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: 'Mux 통합 테스트' },
  })
  if (error || !data.user) throw error ?? new Error('Mux test user was not created')
  return data.user
}

async function createUserClient(config: TestConfig, user: User): Promise<SupabaseClient> {
  if (!user.email) throw new Error('Mux test email is required')
  const client = createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY)
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: config.TEST_USER_PASSWORD,
  })
  if (error) throw error
  return client
}

async function createBookChat(client: SupabaseClient): Promise<{ roomId: string; chatId: string }> {
  const roomResponse = await client.rpc('create_reading_room', {
    p_name: 'Mux 통합 테스트 방',
    p_description: null,
    p_room_display_name: '테스터',
  })
  if (roomResponse.error) throw roomResponse.error
  const roomId = roomResultSchema.parse(roomResponse.data)[0]?.room_id
  if (!roomId) throw new Error('Mux test room is required')

  const chatResponse = await client.rpc('create_book_chat', {
    p_room_id: roomId,
    p_source: 'manual',
    p_title: 'Mux 통합 테스트 책',
    p_name: '영상 기록',
  })
  if (chatResponse.error) throw chatResponse.error
  const chatId = chatResultSchema.parse(chatResponse.data)[0]?.book_chat_id
  if (!chatId) throw new Error('Mux test chat is required')
  return { roomId, chatId }
}

async function uploadVideo(uploadUrl: string, sourceUrl: string): Promise<void> {
  const source = await fetch(sourceUrl)
  if (!source.ok) throw new Error('Mux test video download failed')
  const contentType = source.headers.get('content-type') ?? 'video/mp4'
  const upload = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': contentType },
    body: await source.arrayBuffer(),
  })
  if (!upload.ok) throw new Error(`Mux direct upload failed: ${upload.status}`)
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function waitForReadyAsset(admin: SupabaseClient, postId: string): Promise<number> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const response = await admin
      .from('video_assets')
      .select('status, duration_seconds, error_code')
      .eq('post_id', postId)
      .single()
    if (response.error) throw response.error
    const asset = videoAssetSchema.parse(response.data)
    if (asset.status === 'failed') throw new Error(`Mux processing failed: ${asset.error_code}`)
    if (asset.status === 'ready' && asset.duration_seconds !== null) return asset.duration_seconds
    await wait(3_000)
  }
  throw new Error('Mux asset did not become ready within 180 seconds')
}

async function cleanup(
  client: SupabaseClient,
  admin: SupabaseClient,
  config: TestConfig,
  roomId: string | null,
  user: User | null,
): Promise<void> {
  if (roomId) {
    await client.rpc('delete_reading_room', {
      p_room_id: roomId,
      p_confirmation_name: 'Mux 통합 테스트 방',
    })
    await client.functions.invoke('deletion-worker', {
      method: 'POST',
      headers: { authorization: `Bearer ${config.DELETION_WORKER_SECRET}` },
    })
  }
  if (user) await admin.auth.admin.deleteUser(user.id)
}

Deno.test('Mux direct upload becomes ready and plays with a signed token', async () => {
  const config = readConfig()
  if (!config) return

  const admin = createAdmin(config)
  let user: User | null = null
  let roomId: string | null = null
  let client: SupabaseClient | null = null

  try {
    user = await createUser(admin, config)
    client = await createUserClient(config, user)
    const room = await createBookChat(client)
    roomId = room.roomId

    const uploadResponse = await client.functions.invoke('mux-create-upload', {
      body: {
        bookChatId: room.chatId,
        clientId: crypto.randomUUID(),
        caption: '30초 이하 통합 테스트 영상',
        labels: [],
        mentionedMemberIds: [],
      },
      headers: { origin: config.TEST_ORIGIN },
    })
    if (uploadResponse.error) throw uploadResponse.error
    const upload = uploadResultSchema.parse(uploadResponse.data).data
    await uploadVideo(upload.uploadUrl, config.TEST_MUX_VIDEO_URL)

    const duration = await waitForReadyAsset(admin, upload.postId)
    assert(duration > 0 && duration <= 30)

    const playbackResponse = await client.functions.invoke('mux-playback-token', {
      body: { postId: upload.postId },
      headers: { origin: config.TEST_ORIGIN },
    })
    if (playbackResponse.error) throw playbackResponse.error
    const playback = playbackResultSchema.parse(playbackResponse.data).data
    const manifest = await fetch(
      `https://stream.mux.com/${playback.playbackId}.m3u8?token=${encodeURIComponent(playback.token)}`,
    )
    assertEquals(manifest.ok, true)
  } finally {
    if (client) await cleanup(client, admin, config, roomId, user)
    else if (user) await admin.auth.admin.deleteUser(user.id)
  }
})
