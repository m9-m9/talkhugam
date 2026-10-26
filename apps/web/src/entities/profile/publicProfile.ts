import type { SupabaseClient } from '@supabase/supabase-js'
import { mapPublicProfile, type PublicProfile } from '@talkhugam/domain'
import { z } from 'zod'

const publicProfileRowsSchema = z.array(z.unknown())
const rpcResultSchema = z.boolean()

/** 공개 프로필 전용 RPC의 한 행을 검증해 도메인 모델로 반환한다. */
function parseSinglePublicProfile(input: unknown): PublicProfile {
  const rows = publicProfileRowsSchema.parse(input)
  const row = rows.at(0)
  if (!row) throw new Error('공개 프로필을 찾을 수 없어요.')
  return mapPublicProfile(row)
}

/** 다른 회원의 공개 허용 필드와 현재 팔로우 상태만 조회한다. */
export async function getPublicProfile(
  client: SupabaseClient,
  profileId: string,
): Promise<PublicProfile> {
  const response = await client.rpc('get_public_profile', { p_profile_id: profileId })
  if (response.error) throw response.error
  return parseSinglePublicProfile(response.data)
}

/** 공개 프로필의 팔로워를 최대 스무 명까지 공개 허용 필드로 조회한다. */
export async function listPublicProfileFollowers(
  client: SupabaseClient,
  profileId: string,
): Promise<PublicProfile[]> {
  const response = await client.rpc('list_public_profile_followers', {
    p_limit: 20,
    p_profile_id: profileId,
  })
  if (response.error) throw response.error
  return publicProfileRowsSchema.parse(response.data).map(mapPublicProfile)
}

/** 현재 로그인한 회원이 지정한 공개 프로필을 팔로우하고 새 관계 생성 여부를 반환한다. */
export async function followPublicProfile(
  client: SupabaseClient,
  profileId: string,
): Promise<boolean> {
  const response = await client.rpc('follow_profile', { p_followed_profile_id: profileId })
  if (response.error) throw response.error
  return rpcResultSchema.parse(response.data)
}

/** 현재 로그인한 회원의 지정 프로필 팔로우를 해제하고 기존 관계 삭제 여부를 반환한다. */
export async function unfollowPublicProfile(
  client: SupabaseClient,
  profileId: string,
): Promise<boolean> {
  const response = await client.rpc('unfollow_profile', { p_followed_profile_id: profileId })
  if (response.error) throw response.error
  return rpcResultSchema.parse(response.data)
}
