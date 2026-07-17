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
  author_member_id: z.string().uuid().nullable(),
  author_name_snapshot: z.string(),
  body: z.string().nullable(),
  created_at: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
  video_assets: z.union([videoPostAssetSchema, z.array(videoPostAssetSchema).max(1)]).nullable(),
})

const videoFilterMemberRowSchema = z.object({
  id: z.string().uuid(),
  profile_id: z.string().uuid().nullable(),
  room_display_name: z.string().min(1).max(30),
})

export type VideoAsset = {
  errorCode: string | null
  postId: string
  status: z.infer<typeof videoAssetSchema>['status']
}
export type VideoPlaybackAuthorization = z.infer<typeof playbackAuthorizationSchema>['data']
export type UploadedVideoNavigationState = z.infer<typeof uploadedVideoNavigationStateSchema>
export type VideoPost = {
  authorMemberId: string | null
  authorName: string
  body: string | null
  createdAt: string
  id: string
  status: VideoAsset['status']
}
export type VideoFilterMember = {
  displayName: string
  id: string
  isCurrentUser: boolean
}
export type VideoPostFilter =
  { kind: 'all' } | { kind: 'member'; memberId: string } | { kind: 'mine'; memberId: string | null }
export const videoKeys = {
  /** 책 대화방 식별자로 안정적인 query key를 생성한다. */
  byBookChat: (bookChatId: string) => ['video-posts', bookChatId] as const,
  /** 독서방 식별자로 영상 필터 멤버 query key를 생성한다. */
  members: (roomId: string) => ['video-filter-members', roomId] as const,
  /** 메시지 식별자로 안정적인 query key를 생성한다. */
  byPost: (postId: string) => ['video-asset', postId] as const,
  /** 메시지 식별자로 영상 재생 query key를 생성한다. */
  playback: (postId: string) => ['video-playback', postId] as const,
}

/** 영상 업로드 데이터를 생성해 반환한다. */
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

/** 영상 파일 데이터를 외부 저장소에 업로드한다. */
export async function uploadVideoFile(uploadUrl: string, file: File): Promise<void> {
  const response = await fetch(uploadUrl, {
    body: file,
    headers: { 'content-type': file.type },
    method: 'PUT',
  })
  if (!response.ok) throw new Error('Video upload failed')
}

/** 영상 자산 데이터를 조회하거나 계산해 반환한다. */
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

/** 영상 메시지 목록 데이터를 조회하거나 계산해 반환한다. */
export async function getVideoPosts(
  client: SupabaseClient,
  bookChatId: string,
): Promise<VideoPost[]> {
  const response = await client
    .from('posts')
    .select('id, body, author_member_id, author_name_snapshot, created_at, video_assets(status)')
    .eq('book_chat_id', bookChatId)
    .eq('type', 'video')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (response.error) throw response.error
  return parseVideoPosts(response.data)
}

/** 영상 메시지 데이터를 조회하거나 계산해 반환한다. */
export async function getVideoPost(
  client: SupabaseClient,
  bookChatId: string,
  postId: string,
): Promise<VideoPost | null> {
  const response = await client
    .from('posts')
    .select('id, body, author_member_id, author_name_snapshot, created_at, video_assets(status)')
    .eq('id', postId)
    .eq('book_chat_id', bookChatId)
    .eq('type', 'video')
    .is('deleted_at', null)
    .maybeSingle()
  if (response.error) throw response.error
  if (!response.data) return null
  return mapVideoPost(videoPostRowSchema.parse(response.data))
}

/** 영상 필터 멤버 목록 데이터를 조회하거나 계산해 반환한다. */
export async function getVideoFilterMembers(
  client: SupabaseClient,
  roomId: string,
): Promise<VideoFilterMember[]> {
  const [membersResponse, userResponse] = await Promise.all([
    client
      .from('room_members')
      .select('id, profile_id, room_display_name')
      .eq('room_id', roomId)
      .eq('status', 'active')
      .order('joined_at', { ascending: true }),
    client.auth.getUser(),
  ])
  if (membersResponse.error) throw membersResponse.error
  if (userResponse.error) throw userResponse.error
  return parseVideoFilterMembers(membersResponse.data, userResponse.data.user.id)
}

/** 영상 메시지 관련 데이터를 안전하게 삭제한다. */
export async function deleteVideoPost(client: SupabaseClient, postId: string): Promise<void> {
  const response = await client.rpc('delete_video_post', { p_post_id: postId })
  if (response.error) throw response.error
}

/** 영상 재생 권한 데이터를 조회하거나 계산해 반환한다. */
export async function getVideoPlaybackAuthorization(
  client: SupabaseClient,
  postId: string,
): Promise<VideoPlaybackAuthorization> {
  const response = await client.functions.invoke('mux-playback-token', { body: { postId } })
  if (response.error) throw response.error
  return parseVideoPlaybackAuthorization(response.data)
}

/** 외부 입력을 검증해 영상 재생 권한 형식으로 변환한다. */
export function parseVideoPlaybackAuthorization(value: unknown): VideoPlaybackAuthorization {
  return playbackAuthorizationSchema.parse(value).data
}

/** 업로드 완료 영상 이동 상태 데이터를 조회하거나 계산해 반환한다. */
export function getUploadedVideoNavigationState(
  value: unknown,
): UploadedVideoNavigationState | null {
  const parsed = uploadedVideoNavigationStateSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

/** 외부 입력을 검증해 영상 메시지 목록 형식으로 변환한다. */
export function parseVideoPosts(value: unknown): VideoPost[] {
  return z.array(videoPostRowSchema).parse(value).map(mapVideoPost)
}

/** 외부 입력을 검증해 영상 필터 멤버 목록 형식으로 변환한다. */
export function parseVideoFilterMembers(
  value: unknown,
  currentUserId: string,
): VideoFilterMember[] {
  return z
    .array(videoFilterMemberRowSchema)
    .parse(value)
    .map((member) => ({
      displayName: member.room_display_name,
      id: member.id,
      isCurrentUser: member.profile_id === currentUserId,
    }))
}

/** 조건에 맞는 영상 메시지 목록만 골라 반환한다. */
export function filterVideoPosts(
  posts: readonly VideoPost[],
  filter: VideoPostFilter,
): VideoPost[] {
  if (filter.kind === 'all') return [...posts]
  if (filter.memberId === null) return []
  return posts.filter((post) => post.authorMemberId === filter.memberId)
}

/** Mux 썸네일 URL 데이터를 생성해 반환한다. */
export function createMuxThumbnailUrl(authorization: VideoPlaybackAuthorization): string {
  const playbackId = encodeURIComponent(authorization.playbackId)
  const token = encodeURIComponent(authorization.thumbnailToken)
  return `https://image.mux.com/${playbackId}/thumbnail.webp?token=${token}`
}

/** Refresh 영상 메시지 목록 조건을 충족하는지 판별한다. */
export function shouldRefreshVideoPosts(
  posts: VideoPost[] | undefined,
  uploadedVideo: UploadedVideoNavigationState | null = null,
  now = Date.now(),
): boolean {
  const hasPendingVideo =
    posts?.some((post) => post.status === 'waiting_upload' || post.status === 'processing') ?? false
  return hasPendingVideo || shouldShowUploadedVideoPlaceholder(posts, uploadedVideo, now)
}

/** 표시 Uploaded 영상 대기 상태 조건을 충족하는지 판별한다. */
export function shouldShowUploadedVideoPlaceholder(
  posts: VideoPost[] | undefined,
  uploadedVideo: UploadedVideoNavigationState | null,
  now = Date.now(),
): boolean {
  if (uploadedVideo === null) return false
  if (now - uploadedVideo.uploadedVideoStartedAt > 45_000) return false
  return !posts?.some((post) => post.id === uploadedVideo.uploadedVideoPostId)
}

/** 영상 재생 시간 값의 유효성을 검증한다. */
export function validateVideoDuration(durationSeconds: number): boolean {
  return Number.isFinite(durationSeconds) && durationSeconds > 0 && durationSeconds <= 30
}

/** 영상 재생 시간 데이터를 조회하거나 계산해 반환한다. */
export async function getVideoDuration(file: File): Promise<number> {
  const url = URL.createObjectURL(file)
  try {
    return await new Promise((resolve, reject) => {
      const video = document.createElement('video')
      video.onloadedmetadata = () => resolve(video.duration)
      video.onerror = () => reject(new Error('metadata'))
      video.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** 원본 데이터를 영상 메시지 도메인 모델로 변환한다. */
function mapVideoPost(row: z.infer<typeof videoPostRowSchema>): VideoPost {
  const asset = Array.isArray(row.video_assets) ? row.video_assets[0] : row.video_assets
  return {
    authorMemberId: row.author_member_id,
    authorName: row.author_name_snapshot,
    body: row.body,
    createdAt: row.created_at,
    id: row.id,
    status: asset?.status ?? 'waiting_upload',
  }
}
