import type { SupabaseClient } from '@supabase/supabase-js'
import { parsePosts, type DiscussionPost, type PostForm } from '@talkhugam/domain'
import { z } from 'zod'

const discussionMemberRowSchema = z.object({
  id: z.string().uuid(),
  room_display_name: z.string().trim().min(1).max(30),
})

/** 책방 멤버를 이름 충돌 없이 멘션할 때 사용하는 식별 가능한 후보를 나타낸다. */
export type MobileDiscussionMember = {
  displayName: string
  id: string
  mentionToken: string
}

/** 경로의 책방에 속하고 RLS로 공개된 텍스트 책 대화만 시간순으로 읽어 반환한다. */
export async function getMobileDiscussionPosts(
  client: SupabaseClient,
  roomId: string,
  bookChatId: string,
): Promise<DiscussionPost[]> {
  const response = await client
    .from('posts')
    .select(
      'id, body, depth, root_post_id, author_member_id, author_name_snapshot, created_at, post_labels(kind, value, sort_order), book_chats!inner(room_id)',
    )
    .eq('book_chat_id', z.string().uuid().parse(bookChatId))
    .eq('type', 'text')
    .is('deleted_at', null)
    .eq('book_chats.room_id', z.string().uuid().parse(roomId))
    .order('created_at', { ascending: true })

  if (response.error) throw response.error
  return parsePosts(response.data)
}

/** 현재 회원의 활성 책방 멤버 후보를 안정적인 멘션 토큰과 함께 반환한다. */
export async function getMobileDiscussionMembers(
  client: SupabaseClient,
  roomId: string,
): Promise<MobileDiscussionMember[]> {
  const response = await client
    .from('room_members')
    .select('id, room_display_name')
    .eq('room_id', z.string().uuid().parse(roomId))
    .eq('status', 'active')
    .order('joined_at', { ascending: true })

  if (response.error) throw response.error
  return z.array(discussionMemberRowSchema).parse(response.data).map(mapMobileDiscussionMember)
}

/** 같은 제출 시도에서 재전송해도 중복 생성되지 않도록 clientId를 포함해 루트 글을 저장한다. */
export async function createMobileDiscussionPost(
  client: SupabaseClient,
  bookChatId: string,
  clientId: string,
  values: PostForm,
): Promise<string> {
  const response = await client.rpc('create_post', {
    p_body: values.body,
    p_book_chat_id: z.string().uuid().parse(bookChatId),
    p_client_id: z.string().uuid().parse(clientId),
    p_labels: values.labels,
    p_mentioned_member_ids: values.mentionedMemberIds,
    p_type: 'text',
  })

  if (response.error) throw response.error
  return z.string().uuid().parse(response.data)
}

/** 한 단계 답글만 허용하는 서버 RPC에 같은 제출 식별자와 멘션을 전달한다. */
export async function createMobileDiscussionReply(
  client: SupabaseClient,
  rootPostId: string,
  clientId: string,
  values: PostForm,
): Promise<string> {
  const response = await client.rpc('create_reply', {
    p_body: values.body,
    p_client_id: z.string().uuid().parse(clientId),
    p_mentioned_member_ids: values.mentionedMemberIds,
    p_root_post_id: z.string().uuid().parse(rootPostId),
  })

  if (response.error) throw response.error
  return z.string().uuid().parse(response.data)
}

/** DB 멤버 행을 표시명과 분리된 공백·특수문자 안전 멘션 토큰 후보로 변환한다. */
function mapMobileDiscussionMember(
  row: z.infer<typeof discussionMemberRowSchema>,
): MobileDiscussionMember {
  return {
    displayName: row.room_display_name,
    id: row.id,
    mentionToken: `member-${row.id}`,
  }
}
