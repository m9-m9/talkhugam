import type { SupabaseClient } from '@supabase/supabase-js'
import {
  canDeleteVideoPost,
  createMuxThumbnailUrl,
  filterVideoPosts,
  getUploadedVideoNavigationState,
  mapVideoThumbnailAuthorizations,
  parseVideoAsset,
  parseVideoDeletePermission,
  parseVideoFilterMembers,
  parseVideoPlaybackAuthorization,
  parseVideoPosts,
  parseVideoThumbnailAuthorizations,
  parseVideoUploadResponse,
  shouldRefreshVideoPosts,
  shouldShowUploadedVideoPlaceholder,
  validateVideoDuration,
  videoKeys,
  type UploadedVideoNavigationState,
  type VideoAsset,
  type VideoDeletePermission,
  type VideoFilterMember,
  type VideoPlaybackAuthorization,
  type VideoPost,
  type VideoPostFilter,
  type VideoThumbnailAuthorization,
} from '@talkhugam/domain'

export {
  canDeleteVideoPost,
  createMuxThumbnailUrl,
  filterVideoPosts,
  getUploadedVideoNavigationState,
  mapVideoThumbnailAuthorizations,
  parseVideoDeletePermission,
  parseVideoFilterMembers,
  parseVideoPlaybackAuthorization,
  parseVideoPosts,
  parseVideoThumbnailAuthorizations,
  shouldRefreshVideoPosts,
  shouldShowUploadedVideoPlaceholder,
  validateVideoDuration,
  videoKeys,
  type UploadedVideoNavigationState,
  type VideoAsset,
  type VideoDeletePermission,
  type VideoFilterMember,
  type VideoPlaybackAuthorization,
  type VideoPost,
  type VideoPostFilter,
  type VideoThumbnailAuthorization,
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
  return parseVideoUploadResponse(response.data)
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
  return parseVideoAsset(response.data)
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
  return parseVideoPosts([response.data])[0] ?? null
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

/** 현재 로그인 멤버의 역할과 영상 작성자를 비교해 삭제 가능 여부를 조회한다. */
export async function getVideoDeletePermission(
  client: SupabaseClient,
  roomId: string,
  authorMemberId: string | null,
): Promise<VideoDeletePermission> {
  const userResponse = await client.auth.getUser()
  if (userResponse.error) throw userResponse.error

  const profileId = userResponse.data.user?.id
  if (profileId === undefined) return { canDelete: false }

  const memberResponse = await client
    .from('room_members')
    .select('id, role')
    .eq('room_id', roomId)
    .eq('profile_id', profileId)
    .eq('status', 'active')
    .maybeSingle()

  if (memberResponse.error) throw memberResponse.error
  return parseVideoDeletePermission(memberResponse.data, authorMemberId)
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

/** 영상 목록에 표시할 Mux 썸네일 권한 데이터를 한 번에 조회한다. */
export async function getVideoThumbnailAuthorizations(
  client: SupabaseClient,
  postIds: readonly string[],
): Promise<VideoThumbnailAuthorization[]> {
  const response = await client.functions.invoke('mux-thumbnail-tokens', {
    body: { postIds: [...new Set(postIds)] },
  })
  if (response.error) throw response.error
  return parseVideoThumbnailAuthorizations(response.data)
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
