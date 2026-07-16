import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { assertEquals } from 'jsr:@std/assert@1.0.14'
import { z } from 'zod'

const configSchema = z.object({
  RUN_INTEGRATION_TESTS: z.literal('true'),
  SUPABASE_URL: z.url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
  TEST_USER_PASSWORD: z.string().min(8),
})

const providerSchema = z.enum(['google', 'kakao', 'naver'])
const profileSchema = z.object({ id: z.uuid(), display_name: z.string().min(1) })
const preferenceSchema = z.object({
  profile_id: z.uuid(),
  replies_enabled: z.boolean(),
  mentions_enabled: z.boolean(),
  room_events_enabled: z.boolean(),
})

type TestConfig = z.infer<typeof configSchema>
type Provider = z.infer<typeof providerSchema>

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

function createAdmin(config: TestConfig): SupabaseClient {
  return createClient(config.SUPABASE_URL, config.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function createProviderUser(
  admin: SupabaseClient,
  config: TestConfig,
  provider: Provider,
): Promise<User> {
  const email = `auth-${provider}-${crypto.randomUUID()}@test.local`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: config.TEST_USER_PASSWORD,
    email_confirm: true,
    user_metadata: { provider, display_name: `${provider} 사용자` },
  })
  if (error || !data.user) throw error ?? new Error('Provider test user was not created')
  return data.user
}

async function signIn(config: TestConfig, user: User): Promise<SupabaseClient> {
  if (!user.email) throw new Error('Provider test email is required')
  const client = createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY)
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: config.TEST_USER_PASSWORD,
  })
  if (error) throw error
  return client
}

async function assertOnboardingRecords(
  admin: SupabaseClient,
  client: SupabaseClient,
  user: User,
  provider: Provider,
): Promise<void> {
  const [profileResponse, preferenceResponse, ownProfileResponse] = await Promise.all([
    admin.from('profiles').select('id, display_name').eq('id', user.id).single(),
    admin.from('notification_preferences')
      .select('profile_id, replies_enabled, mentions_enabled, room_events_enabled')
      .eq('profile_id', user.id)
      .single(),
    client.from('profiles').select('id, display_name').eq('id', user.id).single(),
  ])
  if (profileResponse.error) throw profileResponse.error
  if (preferenceResponse.error) throw preferenceResponse.error
  if (ownProfileResponse.error) throw ownProfileResponse.error

  assertEquals(profileSchema.parse(profileResponse.data), {
    id: user.id,
    display_name: `${provider} 사용자`,
  })
  assertEquals(preferenceSchema.parse(preferenceResponse.data), {
    profile_id: user.id,
    replies_enabled: true,
    mentions_enabled: true,
    room_events_enabled: true,
  })
  assertEquals(profileSchema.parse(ownProfileResponse.data).id, user.id)
}

Deno.test('Google, Kakao, and Naver identities create one reusable backend profile', async () => {
  const config = readConfig()
  if (!config) return

  const admin = createAdmin(config)
  const users: User[] = []

  try {
    for (const provider of providerSchema.options) {
      const user = await createProviderUser(admin, config, provider)
      users.push(user)
      const firstSession = await signIn(config, user)
      await assertOnboardingRecords(admin, firstSession, user, provider)

      const secondSession = await signIn(config, user)
      const { data, error } = await secondSession.auth.getUser()
      if (error) throw error
      assertEquals(data.user.id, user.id)
    }

    const firstClient = await signIn(config, users[0] as User)
    const hiddenProfileResponse = await firstClient
      .from('profiles')
      .select('id')
      .eq('id', (users[1] as User).id)
    if (hiddenProfileResponse.error) throw hiddenProfileResponse.error
    assertEquals(hiddenProfileResponse.data, [])
  } finally {
    await Promise.allSettled(users.map((user) => admin.auth.admin.deleteUser(user.id)))
  }
})
