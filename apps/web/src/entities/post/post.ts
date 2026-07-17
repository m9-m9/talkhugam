import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

const postRowSchema = z.object({
  author_name_snapshot: z.string(),
  body: z.string().nullable(),
  created_at: z.string().datetime({ offset: true }),
  depth: z.union([z.literal(0), z.literal(1)]),
  id: z.string().uuid(),
  post_labels: z
    .array(
      z.object({
        kind: z.enum(['page', 'chapter', 'custom']),
        sort_order: z.number().int().nonnegative(),
        value: z.string().min(1).max(40),
      }),
    )
    .default([]),
  root_post_id: z.string().uuid().nullable(),
})

const postLabelSchema = z.object({
  kind: z.enum(['page', 'chapter', 'custom']),
  value: z.string().trim().min(1).max(40),
})

const postFormSchema = z
  .object({
    body: z.string().trim().max(500),
    labels: z.array(postLabelSchema).max(10).default([]),
  })
  .refine((value) => value.body.length > 0 || value.labels.length > 0, {
    message: '감상이나 라벨을 하나 이상 남겨 주세요.',
  })

export type DiscussionPost = {
  authorName: string
  body: string | null
  createdAt: string
  depth: 0 | 1
  id: string
  labels: z.infer<typeof postLabelSchema>[]
  rootPostId: string | null
}
export type PostForm = z.infer<typeof postFormSchema>

export const postKeys = { byBookChat: (bookChatId: string) => ['posts', bookChatId] as const }

export function parsePosts(value: unknown): DiscussionPost[] {
  return z.array(postRowSchema).parse(value).map(mapDiscussionPost)
}

export async function getPosts(
  client: SupabaseClient,
  bookChatId: string,
): Promise<DiscussionPost[]> {
  const response = await client
    .from('posts')
    .select(
      'id, body, depth, root_post_id, author_name_snapshot, created_at, post_labels(kind, value, sort_order)',
    )
    .eq('book_chat_id', bookChatId)
    .eq('type', 'text')
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
    p_labels: values.labels,
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

function mapDiscussionPost(row: z.infer<typeof postRowSchema>): DiscussionPost {
  return {
    authorName: row.author_name_snapshot,
    body: row.body,
    createdAt: row.created_at,
    depth: row.depth,
    id: row.id,
    labels: [...row.post_labels]
      .sort((first, second) => first.sort_order - second.sort_order)
      .map(({ kind, value }) => ({ kind, value })),
    rootPostId: row.root_post_id,
  }
}
