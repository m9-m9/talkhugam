import type { SupabaseClient } from '@supabase/supabase-js'
import { mapPublicProfile, type PublicProfile } from '@talkhugam/domain'
import { z } from 'zod'

const publicProfileRowsSchema = z.array(z.unknown())
const mutationResultSchema = z.boolean()

/** 공개 프로필 RPC의 첫 행을 검증해 모바일 화면 모델로 반환한다. */
function parseMobilePublicProfile(input: unknown): PublicProfile {
  const row = publicProfileRowsSchema.parse(input).at(0)
  if (!row) throw new Error('프로필을 찾을 수 없어요.')
  return mapPublicProfile(row)
}

/** 지정한 회원의 공개 허용 필드와 현재 팔로우 상태만 조회한다. */
export async function getMobilePublicProfile(client: SupabaseClient, profileId: string): Promise<PublicProfile> {
  const response = await client.rpc('get_public_profile', { p_profile_id: profileId })
  if (response.error) throw response.error
  return parseMobilePublicProfile(response.data)
}

/** 지정한 공개 프로필의 팔로워를 최대 스무 명까지 조회한다. */
export async function getMobilePublicProfileFollowers(
  client: SupabaseClient,
  profileId: string,
): Promise<PublicProfile[]> {
  const response = await client.rpc('list_public_profile_followers', { p_limit: 20, p_profile_id: profileId })
  if (response.error) throw response.error
  return publicProfileRowsSchema.parse(response.data).map(mapPublicProfile)
}

/** 현재 회원이 지정한 공개 프로필을 팔로우하고 새 관계 생성 여부를 반환한다. */
export async function followMobilePublicProfile(client: SupabaseClient, profileId: string): Promise<boolean> {
  const response = await client.rpc('follow_profile', { p_followed_profile_id: profileId })
  if (response.error) throw response.error
  return mutationResultSchema.parse(response.data)
}

/** 현재 회원의 지정 공개 프로필 팔로우를 해제하고 관계 삭제 여부를 반환한다. */
export async function unfollowMobilePublicProfile(client: SupabaseClient, profileId: string): Promise<boolean> {
  const response = await client.rpc('unfollow_profile', { p_followed_profile_id: profileId })
  if (response.error) throw response.error
  return mutationResultSchema.parse(response.data)
}
