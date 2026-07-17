import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

const uploadResponseSchema = z.object({
  data: z.object({ postId: z.string().uuid(), uploadUrl: z.string().url() }),
  ok: z.literal(true),
})

const playbackAuthorizationSchema = z.object({
  data: z.object({
    expiresAt: z.number().int().positive(),
    playbackId: z.string().min(1),
    thumbnailToken: z.string().min(1),
    token: z.string().min(1),
  }),
  ok: z.literal(true),
})

const uploadedVideoNavigationStateSchema = z.object({
  uploadedVideoPostId: z.string().uuid(),
  uploadedVideoStartedAt: z.number().int().positive(),
})

const videoAssetSchema = z.object({
  error_code: z.string().nullable(),
  post_id: z.string().uuid(),
  status: z.enum(['waiting_upload', 'processing', 'ready', 'failed', 'deleted']),
})

const videoPostAssetSchema = z.object({
  status: z.enum(['waiting_upload', 'processing', 'ready', 'failed', 'deleted']),
})

const videoPostRowSchema = z.object({
  author_name_snapshot: z.string(),
  body: z.string().nullable(),
  created_at: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
  video_assets: z.union([videoPostAssetSchema, z.array(videoPostAssetSchema).max(1)]).nullable(),
})

export type VideoAsset = {
  errorCode: string | null
  postId: string
  status: z.infer<typeof videoAssetSchema>['status']
}
export type VideoPlaybackAuthorization = z.infer<typeof playbackAuthorizationSchema>['data']
export type UploadedVideoNavigationState = z.infer<typeof uploadedVideoNavigationStateSchema>
export type VideoPost = {
  authorName: string
  body: string | null
  createdAt: string
  id: string
  status: VideoAsset['status']
}
export const videoKeys = {
  byBookChat: (bookChatId: string) => ['video-posts', bookChatId] as const,
  byPost: (postId: string) => ['video-asset', postId] as const,
}

export async function createVideoUpload(
  client: SupabaseClient,
  bookChatId: string,
): Promise<{ postId: string; uploadUrl: string }> {
  const response = await client.functions.invoke('mux-create-upload', {
    body: { bookChatId, clientId: crypto.randomUUID(), labels: [], mentionedMemberIds: [] },
  })
  if (response.error) throw response.error
  return uploadResponseSchema.parse(response.data).data
}

export async function uploadVideoFile(uploadUrl: string, file: File): Promise<void> {
  const response = await fetch(uploadUrl, {
    body: file,
    headers: { 'content-type': file.type },
    method: 'PUT',
  })
  if (!response.ok) throw new Error('Video upload failed')
}

export async function getVideoAsset(
  client: SupabaseClient,
  postId: string,
): Promise<VideoAsset | null> {
  const response = await client
    .from('video_assets')
    .select('post_id, status, error_code')
    .eq('post_id', postId)
    .maybeSingle()
  if (response.error) throw response.error
  if (!response.data) return null
  const asset = videoAssetSchema.parse(response.data)
  return { errorCode: asset.error_code, postId: asset.post_id, status: asset.status }
}

export async function getVideoPosts(
  client: SupabaseClient,
  bookChatId: string,
): Promise<VideoPost[]> {
  const response = await client
    .from('posts')
    .select('id, body, author_name_snapshot, created_at, video_assets(status)')
    .eq('book_chat_id', bookChatId)
    .eq('type', 'video')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (response.error) throw response.error
  return parseVideoPosts(response.data)
}

export async function deleteVideoPost(client: SupabaseClient, postId: string): Promise<void> {
  const response = await client.rpc('delete_video_post', { p_post_id: postId })
  if (response.error) throw response.error
}

export async function getVideoPlaybackAuthorization(
  client: SupabaseClient,
  postId: string,
): Promise<VideoPlaybackAuthorization> {
  const response = await client.functions.invoke('mux-playback-token', { body: { postId } })
  if (response.error) throw response.error
  return parseVideoPlaybackAuthorization(response.data)
}

export function parseVideoPlaybackAuthorization(value: unknown): VideoPlaybackAuthorization {
  return playbackAuthorizationSchema.parse(value).data
}

export function getUploadedVideoNavigationState(
  value: unknown,
): UploadedVideoNavigationState | null {
  const parsed = uploadedVideoNavigationStateSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export function parseVideoPosts(value: unknown): VideoPost[] {
  return z.array(videoPostRowSchema).parse(value).map(mapVideoPost)
}

export function shouldRefreshVideoPosts(
  posts: VideoPost[] | undefined,
  uploadedVideo: UploadedVideoNavigationState | null = null,
  now = Date.now(),
): boolean {
  const hasPendingVideo =
    posts?.some((post) => post.status === 'waiting_upload' || post.status === 'processing') ?? false
  return hasPendingVideo || shouldShowUploadedVideoPlaceholder(posts, uploadedVideo, now)
}

export function shouldShowUploadedVideoPlaceholder(
  posts: VideoPost[] | undefined,
  uploadedVideo: UploadedVideoNavigationState | null,
  now = Date.now(),
): boolean {
  if (uploadedVideo === null) return false
  if (now - uploadedVideo.uploadedVideoStartedAt > 45_000) return false
  return !posts?.some((post) => post.id === uploadedVideo.uploadedVideoPostId)
}

export function validateVideoDuration(durationSeconds: number): boolean {
  return Number.isFinite(durationSeconds) && durationSeconds > 0 && durationSeconds <= 30
}

function mapVideoPost(row: z.infer<typeof videoPostRowSchema>): VideoPost {
  const asset = Array.isArray(row.video_assets) ? row.video_assets[0] : row.video_assets
  return {
    authorName: row.author_name_snapshot,
    body: row.body,
    createdAt: row.created_at,
    id: row.id,
    status: asset?.status ?? 'waiting_upload',
  }
}
