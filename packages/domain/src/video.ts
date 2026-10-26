import { z } from 'zod'

import { roomRoleSchema } from './roomPermission'

export const videoUploadResponseSchema = z.object({
  data: z.object({ postId: z.string().uuid(), uploadUrl: z.string().url() }),
  ok: z.literal(true),
})

export const videoPlaybackAuthorizationSchema = z.object({
  data: z.object({
    expiresAt: z.number().int().positive(),
    playbackId: z.string().min(1),
    thumbnailToken: z.string().min(1),
    token: z.string().min(1),
  }),
  ok: z.literal(true),
})

export const videoThumbnailAuthorizationResponseSchema = z.object({
  data: z.object({
    thumbnails: z.array(
      z.object({
        expiresAt: z.number().int().positive(),
        playbackId: z.string().min(1),
        postId: z.string().uuid(),
        thumbnailToken: z.string().min(1),
      }),
    ),
  }),
  ok: z.literal(true),
})

export const uploadedVideoNavigationStateSchema = z.object({
  uploadedVideoPostId: z.string().uuid(),
  uploadedVideoStartedAt: z.number().int().positive(),
})

export const videoAssetSchema = z.object({
  error_code: z.string().nullable(),
  post_id: z.string().uuid(),
  status: z.enum(['waiting_upload', 'processing', 'ready', 'failed', 'deleted']),
})

export const videoPostAssetSchema = z.object({
  status: z.enum(['waiting_upload', 'processing', 'ready', 'failed', 'deleted']),
})

export const videoPostRowSchema = z.object({
  author_member_id: z.string().uuid().nullable(),
  author_name_snapshot: z.string(),
  body: z.string().nullable(),
  created_at: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
  video_assets: z.union([videoPostAssetSchema, z.array(videoPostAssetSchema).max(1)]).nullable(),
})

export const videoFilterMemberRowSchema = z.object({
  id: z.string().uuid(),
  profile_id: z.string().uuid().nullable(),
  room_display_name: z.string().min(1).max(30),
})

export const currentRoomMemberRowSchema = z.object({
  id: z.string().uuid(),
  role: roomRoleSchema,
})

export type VideoAsset = {
  errorCode: string | null
  postId: string
  status: z.infer<typeof videoAssetSchema>['status']
}
export type VideoPlaybackAuthorization = z.infer<typeof videoPlaybackAuthorizationSchema>['data']
export type VideoThumbnailAuthorization = z.infer<
  typeof videoThumbnailAuthorizationResponseSchema
>['data']['thumbnails'][number]
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
export type VideoDeletePermission = { canDelete: boolean }
export type VideoPostFilter =
  { kind: 'all' } | { kind: 'member'; memberId: string } | { kind: 'mine'; memberId: string | null }

type CurrentRoomMemberPermission = {
  currentMemberId: string
  isRoomOwner: boolean
}

/** 웹과 네이티브가 같은 영상 서버 상태를 분리해 저장할 Query Key를 제공한다. */
export const videoKeys = {
  /** 책 대화방 식별자로 안정적인 query key를 생성한다. */
  byBookChat: (bookChatId: string) => ['video-posts', bookChatId] as const,
  /** 책방 식별자로 영상 필터 멤버 query key를 생성한다. */
  members: (roomId: string) => ['video-filter-members', roomId] as const,
  /** 메시지 식별자로 안정적인 query key를 생성한다. */
  byPost: (postId: string) => ['video-asset', postId] as const,
  /** 메시지 식별자로 영상 재생 query key를 생성한다. */
  playback: (postId: string) => ['video-playback', postId] as const,
  /** 메시지 식별자 목록으로 영상 썸네일 query key를 생성한다. */
  thumbnails: (postIds: readonly string[]) => ['video-thumbnails', ...postIds] as const,
  /** 책방과 작성자 식별자로 영상 삭제 권한 query key를 생성한다. */
  deletePermission: (roomId: string, authorMemberId: string | null) =>
    ['video-delete-permission', roomId, authorMemberId] as const,
}

/** Edge Function의 영상 업로드 시작 응답을 검증해 앱용 모델로 반환한다. */
export function parseVideoUploadResponse(
  value: unknown,
): z.infer<typeof videoUploadResponseSchema>['data'] {
  return videoUploadResponseSchema.parse(value).data
}

/** 외부 입력을 검증해 영상 자산 상태 모델로 변환한다. */
export function parseVideoAsset(value: unknown): VideoAsset {
  const asset = videoAssetSchema.parse(value)
  return { errorCode: asset.error_code, postId: asset.post_id, status: asset.status }
}

/** 외부 입력을 검증해 영상 재생 권한 형식으로 변환한다. */
export function parseVideoPlaybackAuthorization(value: unknown): VideoPlaybackAuthorization {
  return videoPlaybackAuthorizationSchema.parse(value).data
}

/** 외부 입력을 검증해 영상 썸네일 권한 목록 형식으로 변환한다. */
export function parseVideoThumbnailAuthorizations(value: unknown): VideoThumbnailAuthorization[] {
  return videoThumbnailAuthorizationResponseSchema.parse(value).data.thumbnails
}

/** 업로드 완료 이동 상태가 유효하면 검증된 모델로, 아니면 null로 반환한다. */
export function getUploadedVideoNavigationState(
  value: unknown,
): UploadedVideoNavigationState | null {
  const parsed = uploadedVideoNavigationStateSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

/** 외부 행 목록을 검증해 화면에서 사용하는 영상 게시물 목록으로 변환한다. */
export function parseVideoPosts(value: unknown): VideoPost[] {
  return z.array(videoPostRowSchema).parse(value).map(mapVideoPost)
}

/** 하나의 검증된 영상 게시물 행을 화면 모델로 변환한다. */
export function mapVideoPost(row: z.infer<typeof videoPostRowSchema>): VideoPost {
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

/** 외부 멤버 행과 현재 프로필을 검증해 영상 필터 후보로 변환한다. */
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

/** 현재 멤버 역할과 작성자 정보를 검증해 영상 삭제 권한을 반환한다. */
export function parseVideoDeletePermission(
  value: unknown,
  authorMemberId: string | null,
): VideoDeletePermission {
  if (value === null) return { canDelete: false }

  const member = currentRoomMemberRowSchema.parse(value)
  return {
    canDelete: canDeleteVideoPost(
      { currentMemberId: member.id, isRoomOwner: member.role === 'owner' },
      authorMemberId,
    ),
  }
}

/** 현재 멤버의 방장 여부와 영상 작성자를 비교해 삭제 허용 여부를 반환한다. */
export function canDeleteVideoPost(
  currentMember: CurrentRoomMemberPermission,
  authorMemberId: string | null,
): boolean {
  if (currentMember.isRoomOwner) return true
  return authorMemberId !== null && currentMember.currentMemberId === authorMemberId
}

/** 선택한 필터 조건에 맞는 영상 게시물만 새 배열로 반환한다. */
export function filterVideoPosts(
  posts: readonly VideoPost[],
  filter: VideoPostFilter,
): VideoPost[] {
  if (filter.kind === 'all') return [...posts]
  if (filter.memberId === null) return []
  return posts.filter((post) => post.authorMemberId === filter.memberId)
}

/** 서명된 Mux 썸네일 권한으로 private 이미지 URL을 생성한다. */
export function createMuxThumbnailUrl(
  authorization: VideoPlaybackAuthorization | VideoThumbnailAuthorization,
): string {
  const playbackId = encodeURIComponent(authorization.playbackId)
  const token = encodeURIComponent(authorization.thumbnailToken)
  return `https://image.mux.com/${playbackId}/thumbnail.webp?token=${token}`
}

/** 썸네일 권한 목록을 게시물 식별자로 빠르게 조회할 수 있는 Map으로 변환한다. */
export function mapVideoThumbnailAuthorizations(
  authorizations: readonly VideoThumbnailAuthorization[],
): ReadonlyMap<string, VideoThumbnailAuthorization> {
  return new Map(authorizations.map((authorization) => [authorization.postId, authorization]))
}

/** 처리 중 자산 또는 갓 업로드한 placeholder가 있으면 목록 polling 필요 여부를 반환한다. */
export function shouldRefreshVideoPosts(
  posts: VideoPost[] | undefined,
  uploadedVideo: UploadedVideoNavigationState | null = null,
  now = Date.now(),
): boolean {
  const hasPendingVideo =
    posts?.some((post) => post.status === 'waiting_upload' || post.status === 'processing') ?? false
  return hasPendingVideo || shouldShowUploadedVideoPlaceholder(posts, uploadedVideo, now)
}

/** 업로드 직후 목록 동기화 전까지 placeholder를 보여야 하는지 반환한다. */
export function shouldShowUploadedVideoPlaceholder(
  posts: VideoPost[] | undefined,
  uploadedVideo: UploadedVideoNavigationState | null,
  now = Date.now(),
): boolean {
  if (uploadedVideo === null) return false
  if (now - uploadedVideo.uploadedVideoStartedAt > 45_000) return false
  return !posts?.some((post) => post.id === uploadedVideo.uploadedVideoPostId)
}

/** 재생 시간 초가 유한한 0초 초과 30초 이하인지 반환한다. */
export function validateVideoDuration(durationSeconds: number): boolean {
  return Number.isFinite(durationSeconds) && durationSeconds > 0 && durationSeconds <= 30
}
