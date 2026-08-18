import type { SupabaseClient } from '@supabase/supabase-js'
import {
  parseVideoFilterMembers,
  parseVideoPlaybackAuthorization,
  parseVideoPosts,
  parseVideoThumbnailAuthorizations,
  type VideoFilterMember,
  type VideoPlaybackAuthorization,
  type VideoPost,
  type VideoThumbnailAuthorization,
} from '@talkhugam/domain'
import { z } from 'zod'

import { getMobileAuthenticatedProfileId } from '../profile'

/** 활성 멤버에게 보이는 특정 책 대화의 삭제되지 않은 영상만 최신순으로 반환한다. */
export async function getMobileVideoPosts(
  client: SupabaseClient,
  roomId: string,
  bookChatId: string,
): Promise<VideoPost[]> {
  const response = await client
    .from('posts')
    .select(
      'id, body, author_member_id, author_name_snapshot, created_at, video_assets(status), book_chats!inner(room_id)',
    )
    .eq('book_chat_id', z.string().uuid().parse(bookChatId))
    .eq('type', 'video')
    .is('deleted_at', null)
    .eq('book_chats.room_id', z.string().uuid().parse(roomId))
    .order('created_at', { ascending: false })

  if (response.error) throw response.error
  return parseVideoPosts(response.data)
}

/** 현재 회원 기준으로 활성 책방 멤버를 영상 작성자 필터 모델로 반환한다. */
export async function getMobileVideoFilterMembers(
  client: SupabaseClient,
  roomId: string,
): Promise<VideoFilterMember[]> {
  const profileId = await getMobileAuthenticatedProfileId(client)
  const response = await client
    .from('room_members')
    .select('id, profile_id, room_display_name')
    .eq('room_id', z.string().uuid().parse(roomId))
    .eq('status', 'active')
    .order('joined_at', { ascending: true })

  if (response.error) throw response.error
  return parseVideoFilterMembers(response.data, profileId)
}

/** RLS로 허용된 ready 영상의 짧은 Mux 재생 토큰을 Edge Function에서 받아 반환한다. */
export async function getMobileVideoPlaybackAuthorization(
  client: SupabaseClient,
  postId: string,
): Promise<VideoPlaybackAuthorization> {
  const response = await client.functions.invoke('mux-playback-token', {
    body: { postId: z.string().uuid().parse(postId) },
  })
  if (response.error) throw response.error
  return parseVideoPlaybackAuthorization(response.data)
}

/** RLS로 허용된 ready 영상들의 Mux 썸네일 토큰을 한 번에 받아 반환한다. */
export async function getMobileVideoThumbnailAuthorizations(
  client: SupabaseClient,
  postIds: readonly string[],
): Promise<VideoThumbnailAuthorization[]> {
  const response = await client.functions.invoke('mux-thumbnail-tokens', {
    body: { postIds: [...new Set(postIds.map((postId) => z.string().uuid().parse(postId)))] },
  })
  if (response.error) throw response.error
  return parseVideoThumbnailAuthorizations(response.data)
}

/** 영상 작성자 또는 방장만 허용하는 서버 RPC로 영상 게시물 삭제를 요청한다. */
export async function deleteMobileVideoPost(client: SupabaseClient, postId: string): Promise<void> {
  const response = await client.rpc('delete_video_post', { p_post_id: z.string().uuid().parse(postId) })
  if (response.error) throw response.error
}
