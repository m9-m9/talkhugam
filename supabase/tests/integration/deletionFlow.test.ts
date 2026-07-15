import {
  createClient,
  type SupabaseClient,
  type User,
} from '@supabase/supabase-js'
import { assertEquals } from 'jsr:@std/assert@1.0.14'
import { z } from 'zod'

const configSchema = z.object({
  RUN_INTEGRATION_TESTS: z.literal('true'),
  SUPABASE_URL: z.url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
  TEST_USER_PASSWORD: z.string().min(8),
})

const roomResultSchema = z.array(z.object({ room_id: z.uuid(), member_id: z.uuid() }))
const inviteResultSchema = z.array(z.object({ code: z.string().length(6) }))
const bookChatResultSchema = z.array(z.object({ book_id: z.uuid(), book_chat_id: z.uuid() }))
const functionResultSchema = z.object({
  ok: z.literal(true),
  data: z.object({ requestId: z.uuid(), deleted: z.literal(true) }),
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
  const email = `deletion-${label}-${crypto.randomUUID()}@test.local`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: config.TEST_USER_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: `삭제 ${label}` },
  })
  if (error || !data.user) throw error ?? new Error('Test user was not created')
  return data.user
}

async function signIn(config: TestConfig, user: User): Promise<SupabaseClient> {
  if (!user.email) throw new Error('Test user email is required')
  const client = createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY)
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: config.TEST_USER_PASSWORD,
  })
  if (error) throw error
  return client
}

async function createRoom(
  client: SupabaseClient,
  name: string,
  displayName: string,
): Promise<{ roomId: string; memberId: string }> {
  const response = await client.rpc('create_reading_room', {
    p_name: name,
    p_description: null,
    p_room_display_name: displayName,
  })
  if (response.error) throw response.error
  const [room] = roomResultSchema.parse(response.data)
  if (!room) throw new Error('Room result is required')
  return { roomId: room.room_id, memberId: room.member_id }
}

async function createChat(
  client: SupabaseClient,
  roomId: string,
  title: string,
): Promise<{ bookId: string; chatId: string }> {
  const response = await client.rpc('create_book_chat', {
    p_room_id: roomId,
    p_source: 'manual',
    p_title: title,
    p_name: `${title} 채팅`,
  })
  if (response.error) throw response.error
  const [chat] = bookChatResultSchema.parse(response.data)
  if (!chat) throw new Error('Book chat result is required')
  return { bookId: chat.book_id, chatId: chat.book_chat_id }
}

async function createTextPost(
  client: SupabaseClient,
  chatId: string,
  body: string,
): Promise<string> {
  const response = await client.rpc('create_post', {
    p_book_chat_id: chatId,
    p_client_id: crypto.randomUUID(),
    p_type: 'text',
    p_body: body,
    p_labels: [],
    p_mentioned_member_ids: [],
  })
  if (response.error) throw response.error
  return z.uuid().parse(response.data)
}

Deno.test('account deletion preserves shared records or tombstones owned content by policy', async () => {
  const config = readConfig()
  if (!config) return

  const admin = createAdminClient(config)
  const users: User[] = []
  const roomIds: string[] = []
  const bookIds: string[] = []

  try {
    const anonymizeUser = await createTestUser(admin, config, 'anonymize')
    const newOwnerUser = await createTestUser(admin, config, 'new-owner')
    const deleteContentUser = await createTestUser(admin, config, 'delete-content')
    users.push(anonymizeUser, newOwnerUser, deleteContentUser)

    const [anonymizeClient, newOwnerClient, deleteContentClient] = await Promise.all([
      signIn(config, anonymizeUser),
      signIn(config, newOwnerUser),
      signIn(config, deleteContentUser),
    ])

    const sharedRoom = await createRoom(anonymizeClient, '공동 기록 보존 방', '기존 방장')
    roomIds.push(sharedRoom.roomId)

    const inviteResponse = await anonymizeClient.rpc('create_room_invite', {
      p_room_id: sharedRoom.roomId,
      p_expires_in: '1 day',
      p_max_uses: 1,
    })
    if (inviteResponse.error) throw inviteResponse.error
    const [invite] = inviteResultSchema.parse(inviteResponse.data)
    if (!invite) throw new Error('Invite result is required')

    const joinResponse = await newOwnerClient.rpc('join_room_by_invite', {
      p_code_or_token: invite.code,
      p_room_display_name: '새 방장',
    })
    if (joinResponse.error) throw joinResponse.error
    const joinedMemberId = z.array(z.object({ member_id: z.uuid() }))
      .parse(joinResponse.data)[0]?.member_id
    if (!joinedMemberId) throw new Error('Joined member id is required')

    const transferResponse = await anonymizeClient.rpc('transfer_room_ownership', {
      p_room_id: sharedRoom.roomId,
      p_target_member_id: joinedMemberId,
    })
    if (transferResponse.error) throw transferResponse.error

    const sharedChat = await createChat(anonymizeClient, sharedRoom.roomId, '공동 기록 책')
    bookIds.push(sharedChat.bookId)
    const preservedPostId = await createTextPost(anonymizeClient, sharedChat.chatId, '남겨둘 공동 기록')

    const anonymizeResponse = await anonymizeClient.functions.invoke('account-delete', {
      body: { mode: 'anonymize' },
    })
    if (anonymizeResponse.error) throw anonymizeResponse.error
    functionResultSchema.parse(anonymizeResponse.data)

    const preservedResponse = await admin
      .from('posts')
      .select('body, author_member_id, author_name_snapshot, deleted_at')
      .eq('id', preservedPostId)
      .single()
    if (preservedResponse.error) throw preservedResponse.error
    assertEquals(preservedResponse.data.body, '남겨둘 공동 기록')
    assertEquals(preservedResponse.data.author_member_id, null)
    assertEquals(preservedResponse.data.author_name_snapshot, '탈퇴한 사용자')
    assertEquals(preservedResponse.data.deleted_at, null)

    const soloRoom = await createRoom(deleteContentClient, '콘텐츠 삭제 방', '삭제 사용자')
    roomIds.push(soloRoom.roomId)
    const soloChat = await createChat(deleteContentClient, soloRoom.roomId, '콘텐츠 삭제 책')
    bookIds.push(soloChat.bookId)
    const deletedPostId = await createTextPost(deleteContentClient, soloChat.chatId, '지울 개인 기록')

    const deleteResponse = await deleteContentClient.functions.invoke('account-delete', {
      body: { mode: 'delete_content' },
    })
    if (deleteResponse.error) throw deleteResponse.error
    functionResultSchema.parse(deleteResponse.data)

    const [deletedPostResponse, deletedRoomResponse] = await Promise.all([
      admin.from('posts').select('body, author_member_id, deleted_at').eq('id', deletedPostId).single(),
      admin.from('reading_rooms').select('status, deleted_at').eq('id', soloRoom.roomId).single(),
    ])
    if (deletedPostResponse.error) throw deletedPostResponse.error
    if (deletedRoomResponse.error) throw deletedRoomResponse.error
    assertEquals(deletedPostResponse.data.body, null)
    assertEquals(deletedPostResponse.data.author_member_id, null)
    assertEquals(deletedPostResponse.data.deleted_at === null, false)
    assertEquals(deletedRoomResponse.data.status, 'deleted')
  } finally {
    await Promise.allSettled(roomIds.map((id) => admin.from('reading_rooms').delete().eq('id', id)))
    await Promise.allSettled(bookIds.map((id) => admin.from('books').delete().eq('id', id)))
    await Promise.allSettled(users.map((user) => admin.auth.admin.deleteUser(user.id)))
  }
})
