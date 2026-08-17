import type { SupabaseClient } from '@supabase/supabase-js'
import { parsePosts, type DiscussionPost, type PostForm } from '@talkhugam/domain'
import { z } from 'zod'

export {
  parsePostForm,
  parsePosts,
  postKeys,
  type DiscussionPost,
  type PostForm,
} from '@talkhugam/domain'

/** 메시지 목록 데이터를 조회하거나 계산해 반환한다. */
export async function getPosts(
  client: SupabaseClient,
  bookChatId: string,
): Promise<DiscussionPost[]> {
  const response = await client
    .from('posts')
    .select(
      'id, body, depth, root_post_id, author_member_id, author_name_snapshot, created_at, post_labels(kind, value, sort_order)',
    )
    .eq('book_chat_id', bookChatId)
    .eq('type', 'text')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  if (response.error) throw response.error
  return parsePosts(response.data)
}

/** 메시지 데이터를 생성해 반환한다. */
export async function createPost(
  client: SupabaseClient,
  bookChatId: string,
  values: PostForm,
): Promise<string> {
  const response = await client.rpc('create_post', {
    p_body: values.body,
    p_book_chat_id: bookChatId,
    p_client_id: crypto.randomUUID(),
    p_labels: values.labels,
    p_mentioned_member_ids: values.mentionedMemberIds,
    p_type: 'text',
  })
  if (response.error) throw response.error
  return z.string().uuid().parse(response.data)
}

/** 답글 데이터를 생성해 반환한다. */
export async function createReply(
  client: SupabaseClient,
  rootPostId: string,
  values: PostForm,
): Promise<string> {
  const response = await client.rpc('create_reply', {
    p_body: values.body,
    p_client_id: crypto.randomUUID(),
    p_mentioned_member_ids: values.mentionedMemberIds,
    p_root_post_id: rootPostId,
  })
  if (response.error) throw response.error
  return z.string().uuid().parse(response.data)
}
