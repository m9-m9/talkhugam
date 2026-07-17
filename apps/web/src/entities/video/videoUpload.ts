import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

const uploadResponseSchema = z.object({
  data: z.object({ postId: z.string().uuid(), uploadUrl: z.string().url() }),
  ok: z.literal(true),
})

const videoAssetSchema = z.object({
  error_code: z.string().nullable(),
  post_id: z.string().uuid(),
  status: z.enum(['waiting_upload', 'processing', 'ready', 'failed', 'deleted']),
})

export type VideoAsset = {
  errorCode: string | null
  postId: string
  status: z.infer<typeof videoAssetSchema>['status']
}
export const videoKeys = { byPost: (postId: string) => ['video-asset', postId] as const }

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

export function validateVideoDuration(durationSeconds: number): boolean {
  return Number.isFinite(durationSeconds) && durationSeconds > 0 && durationSeconds <= 30
}
