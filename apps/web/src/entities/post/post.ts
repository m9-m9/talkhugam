import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

const postRowSchema = z.object({
  author_name_snapshot: z.string(),
  body: z.string().nullable(),
  created_at: z.string().datetime({ offset: true }),
  depth: z.union([z.literal(0), z.literal(1)]),
  id: z.string().uuid(),
  root_post_id: z.string().uuid().nullable(),
})

const postFormSchema = z.object({ body: z.string().trim().min(1).max(500) })

export type DiscussionPost = z.infer<typeof postRowSchema>
export type PostForm = z.infer<typeof postFormSchema>

export const postKeys = { byBookChat: (bookChatId: string) => ['posts', bookChatId] as const }

export function parsePosts(value: unknown): DiscussionPost[] {
  return z.array(postRowSchema).parse(value)
}

export async function getPosts(
  client: SupabaseClient,
  bookChatId: string,
): Promise<DiscussionPost[]> {
  const response = await client
    .from('posts')
    .select('id, body, depth, root_post_id, author_name_snapshot, created_at')
    .eq('book_chat_id', bookChatId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  if (response.error) throw response.error
  return parsePosts(response.data)
}

export async function createPost(
  client: SupabaseClient,
  bookChatId: string,
  values: PostForm,
): Promise<string> {
  const response = await client.rpc('create_post', {
    p_body: values.body,
    p_book_chat_id: bookChatId,
    p_client_id: crypto.randomUUID(),
    p_type: 'text',
  })
  if (response.error) throw response.error
  return z.string().uuid().parse(response.data)
}

export async function createReply(
  client: SupabaseClient,
  rootPostId: string,
  values: PostForm,
): Promise<string> {
  const response = await client.rpc('create_reply', {
    p_body: values.body,
    p_client_id: crypto.randomUUID(),
    p_root_post_id: rootPostId,
  })
  if (response.error) throw response.error
  return z.string().uuid().parse(response.data)
}

export function parsePostForm(value: unknown): PostForm {
  return postFormSchema.parse(value)
}
