import {
  createClient,
  type SupabaseClient,
  type User,
} from '@supabase/supabase-js'
import {
  assert,
  assertEquals,
  assertStringIncludes,
} from 'jsr:@std/assert@1.0.14'
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
  code: z.string().length(6),
}))

const bookChatResultSchema = z.array(z.object({
  book_id: z.uuid(),
  book_chat_id: z.uuid(),
}))

const notificationSchema = z.object({
  id: z.uuid(),
  type: z.enum(['reply', 'mention']),
  post_id: z.uuid(),
})

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
  label: string,
): Promise<User> {
  const email = `chat-${label}-${crypto.randomUUID()}@test.local`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: config.TEST_USER_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: `채팅 ${label}` },
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

async function deleteTestUsers(
  admin: SupabaseClient,
  users: readonly User[],
): Promise<void> {
  await Promise.allSettled(users.map((user) => admin.auth.admin.deleteUser(user.id)))
}

async function cleanupRecords(
  admin: SupabaseClient,
  roomId: string | null,
  bookIds: readonly string[],
): Promise<void> {
  if (roomId) await admin.from('reading_rooms').delete().eq('id', roomId)
  if (bookIds.length > 0) await admin.from('books').delete().in('id', bookIds)
}

Deno.test('chat retry, reply, mention notification, and deep-link contracts hold', async () => {
  const config = readConfig()
  if (!config) return

  const admin = createAdminClient(config)
  const users: User[] = []
  const bookIds: string[] = []
  let roomId: string | null = null

  try {
    const ownerUser = await createTestUser(admin, config, 'owner')
    const memberUser = await createTestUser(admin, config, 'member')
    users.push(ownerUser, memberUser)

    const [owner, member] = await Promise.all([
      signInTestUser(config, ownerUser),
      signInTestUser(config, memberUser),
    ])

    const roomResponse = await owner.rpc('create_reading_room', {
      p_name: '채팅 통합 테스트 방',
      p_description: null,
      p_room_display_name: '채팅 방장',
    })
    if (roomResponse.error) throw roomResponse.error

    const [room] = roomResultSchema.parse(roomResponse.data)
    if (!room) throw new Error('Room result is required')
    roomId = room.room_id

    const inviteResponse = await owner.rpc('create_room_invite', {
      p_room_id: room.room_id,
      p_expires_in: '1 day',
      p_max_uses: 1,
    })
    if (inviteResponse.error) throw inviteResponse.error

    const [invite] = inviteResultSchema.parse(inviteResponse.data)
    if (!invite) throw new Error('Invite result is required')

    const joinResponse = await member.rpc('join_room_by_invite', {
      p_code_or_token: invite.code,
      p_room_display_name: '채팅 멤버',
    })
    if (joinResponse.error) throw joinResponse.error

    const membersResponse = await owner
      .from('room_members')
      .select('id, profile_id')
      .eq('room_id', room.room_id)
    if (membersResponse.error) throw membersResponse.error

    const ownerMember = membersResponse.data.find((item) => item.profile_id === ownerUser.id)
    const joinedMember = membersResponse.data.find((item) => item.profile_id === memberUser.id)
    if (!ownerMember || !joinedMember) throw new Error('Room members are required')

    const firstChatResponse = await owner.rpc('create_book_chat', {
      p_room_id: room.room_id,
      p_source: 'manual',
      p_title: '채팅 통합 테스트 책',
      p_name: '첫 번째 채팅',
    })
    if (firstChatResponse.error) throw firstChatResponse.error

    const [firstChat] = bookChatResultSchema.parse(firstChatResponse.data)
    if (!firstChat) throw new Error('First book chat is required')
    bookIds.push(firstChat.book_id)

    const secondChatResponse = await owner.rpc('create_book_chat', {
      p_room_id: room.room_id,
      p_source: 'manual',
      p_title: '교차 스레드 테스트 책',
      p_name: '두 번째 채팅',
    })
    if (secondChatResponse.error) throw secondChatResponse.error

    const [secondChat] = bookChatResultSchema.parse(secondChatResponse.data)
    if (!secondChat) throw new Error('Second book chat is required')
    bookIds.push(secondChat.book_id)

    const postClientId = crypto.randomUUID()
    const postResponse = await owner.rpc('create_post', {
      p_book_chat_id: firstChat.book_chat_id,
      p_client_id: postClientId,
      p_type: 'text',
      p_body: '통합 테스트 원문',
      p_labels: [{ kind: 'page', value: '87페이지' }],
      p_mentioned_member_ids: [joinedMember.id],
    })
    if (postResponse.error) throw postResponse.error
    const postId = z.uuid().parse(postResponse.data)

    const retryPostResponse = await owner.rpc('create_post', {
      p_book_chat_id: firstChat.book_chat_id,
      p_client_id: postClientId,
      p_type: 'text',
      p_body: '재전송 본문',
      p_labels: [],
      p_mentioned_member_ids: [],
    })
    if (retryPostResponse.error) throw retryPostResponse.error
    assertEquals(retryPostResponse.data, postId)

    const mentionResponse = await member
      .from('notifications')
      .select('id, type, post_id')
      .eq('type', 'mention')
      .single()
    if (mentionResponse.error) throw mentionResponse.error

    const mention = notificationSchema.parse(mentionResponse.data)
    assertEquals(mention.post_id, postId)

    const mentionTargetResponse = await member
      .from('posts')
      .select('id, book_chat_id, depth')
      .eq('id', mention.post_id)
      .single()
    if (mentionTargetResponse.error) throw mentionTargetResponse.error
    assertEquals(mentionTargetResponse.data.id, postId)
    assertEquals(mentionTargetResponse.data.depth, 0)

    const replyClientId = crypto.randomUUID()
    const replyResponse = await member.rpc('create_reply', {
      p_root_post_id: postId,
      p_client_id: replyClientId,
      p_body: '통합 테스트 답글',
      p_mentioned_member_ids: [ownerMember.id],
    })
    if (replyResponse.error) throw replyResponse.error
    const replyId = z.uuid().parse(replyResponse.data)

    const retryReplyResponse = await member.rpc('create_reply', {
      p_root_post_id: postId,
      p_client_id: replyClientId,
      p_body: '재전송 답글',
      p_mentioned_member_ids: [],
    })
    if (retryReplyResponse.error) throw retryReplyResponse.error
    assertEquals(retryReplyResponse.data, replyId)

    const replyNotificationsResponse = await owner
      .from('notifications')
      .select('id, type, post_id')
      .eq('post_id', replyId)
    if (replyNotificationsResponse.error) throw replyNotificationsResponse.error

    assertEquals(replyNotificationsResponse.data.length, 1)
    const [replyNotificationData] = replyNotificationsResponse.data
    assert(replyNotificationData)
    const replyNotification = notificationSchema.parse(replyNotificationData)
    assertEquals(replyNotification.type, 'reply')

    const replyTargetResponse = await owner
      .from('posts')
      .select('id, root_post_id, depth')
      .eq('id', replyNotification.post_id)
      .single()
    if (replyTargetResponse.error) throw replyTargetResponse.error
    assertEquals(replyTargetResponse.data.root_post_id, postId)
    assertEquals(replyTargetResponse.data.depth, 1)

    const postCountResponse = await owner
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('book_chat_id', firstChat.book_chat_id)
    if (postCountResponse.error) throw postCountResponse.error
    assertEquals(postCountResponse.count, 2)

    const crossThreadResponse = await admin.from('posts').insert({
      book_chat_id: secondChat.book_chat_id,
      author_member_id: ownerMember.id,
      type: 'text',
      body: '교차 스레드 답글',
      parent_post_id: postId,
      root_post_id: postId,
      depth: 1,
      client_id: crypto.randomUUID(),
      author_name_snapshot: '채팅 방장',
    })
    assert(crossThreadResponse.error)
    assertStringIncludes(crossThreadResponse.error.message, 'POST_CROSS_THREAD_REPLY')

    const depthTwoResponse = await admin.from('posts').insert({
      book_chat_id: firstChat.book_chat_id,
      author_member_id: ownerMember.id,
      type: 'text',
      body: '깊이 2 답글',
      parent_post_id: replyId,
      root_post_id: postId,
      depth: 2,
      client_id: crypto.randomUUID(),
      author_name_snapshot: '채팅 방장',
    })
    assert(depthTwoResponse.error)
    assertStringIncludes(depthTwoResponse.error.message, 'posts_phase_one_thread_shape')
  } finally {
    await cleanupRecords(admin, roomId, bookIds)
    await deleteTestUsers(admin, users)
  }
})
