import {
  createClient,
  type SupabaseClient,
  type User,
} from '@supabase/supabase-js'
import { assertEquals, assertStringIncludes } from 'jsr:@std/assert@1.0.14'
import { z } from 'zod'

const configSchema = z.object({
  RUN_INTEGRATION_TESTS: z.literal('true'),
  SUPABASE_URL: z.url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
  TEST_USER_PASSWORD: z.string().min(8),
})

const roomResultSchema = z.array(z.object({
  room_id: z.uuid(),
  member_id: z.uuid(),
}))

const inviteResultSchema = z.array(z.object({
  invite_id: z.uuid(),
  code: z.string().length(6),
  token: z.string().length(64),
  expires_at: z.string(),
}))

type TestConfig = z.infer<typeof configSchema>

function readConfig(): TestConfig | null {
  if (Deno.env.get('RUN_INTEGRATION_TESTS') !== 'true') return null

  return configSchema.parse({
    RUN_INTEGRATION_TESTS: Deno.env.get('RUN_INTEGRATION_TESTS'),
    SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
    SUPABASE_PUBLISHABLE_KEY: Deno.env.get('SUPABASE_PUBLISHABLE_KEY'),
    SUPABASE_SECRET_KEY: Deno.env.get('SUPABASE_SECRET_KEY'),
    TEST_USER_PASSWORD: Deno.env.get('TEST_USER_PASSWORD'),
  })
}

function createAdminClient(config: TestConfig): SupabaseClient {
  return createClient(config.SUPABASE_URL, config.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function createTestUser(
  admin: SupabaseClient,
  config: TestConfig,
  index: number,
): Promise<User> {
  const email = `capacity-${crypto.randomUUID()}-${index}@test.local`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: config.TEST_USER_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: `정원 테스트 ${index}` },
  })

  if (error || !data.user) throw error ?? new Error('Test user was not created')
  return data.user
}

async function signInTestUser(
  config: TestConfig,
  user: User,
): Promise<SupabaseClient> {
  if (!user.email) throw new Error('Test user email is required')

  const client = createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY)
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: config.TEST_USER_PASSWORD,
  })

  if (error) throw error
  return client
}

async function deleteTestUsers(admin: SupabaseClient, users: readonly User[]): Promise<void> {
  await Promise.allSettled(users.map((user) => admin.auth.admin.deleteUser(user.id)))
}

Deno.test('concurrent joins keep a room at six active members', async () => {
  const config = readConfig()
  if (!config) return

  const admin = createAdminClient(config)
  const users: User[] = []

  try {
    for (let index = 0; index < 7; index += 1) {
      users.push(await createTestUser(admin, config, index))
    }

    const clients = await Promise.all(users.map((user) => signInTestUser(config, user)))
    const owner = clients[0]
    if (!owner) throw new Error('Owner client is required')

    const roomResponse = await owner.rpc('create_reading_room', {
      p_name: '동시성 테스트 방',
      p_description: null,
      p_room_display_name: '방장',
    })
    if (roomResponse.error) throw roomResponse.error

    const [room] = roomResultSchema.parse(roomResponse.data)
    if (!room) throw new Error('Room result is required')

    const inviteResponse = await owner.rpc('create_room_invite', {
      p_room_id: room.room_id,
      p_expires_in: '1 day',
      p_max_uses: 10,
    })
    if (inviteResponse.error) throw inviteResponse.error

    const [invite] = inviteResultSchema.parse(inviteResponse.data)
    if (!invite) throw new Error('Invite result is required')

    const joinResults = await Promise.all(
      clients.slice(1).map((client, index) => client.rpc('join_room_by_invite', {
        p_code_or_token: invite.code,
        p_room_display_name: `멤버 ${index + 1}`,
      })),
    )

    const successes = joinResults.filter((result) => !result.error)
    const failures = joinResults.filter((result) => result.error)

    assertEquals(successes.length, 5)
    assertEquals(failures.length, 1)
    assertStringIncludes(failures[0]?.error?.message ?? '', 'ROOM_FULL')

    const memberCountResponse = await admin
      .from('room_members')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', room.room_id)
      .eq('status', 'active')

    if (memberCountResponse.error) throw memberCountResponse.error
    assertEquals(memberCountResponse.count, 6)
  } finally {
    await deleteTestUsers(admin, users)
  }
})
