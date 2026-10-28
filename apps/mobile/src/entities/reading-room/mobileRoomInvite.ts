import type { SupabaseClient } from '@supabase/supabase-js'
import { parseRoomRole, type RoomRole } from '@talkhugam/domain'
import { z } from 'zod'

export { createMobileRoomInvite } from './mobileRoomEntry'

/** 초대 링크가 가리키는 웹 주소. 앱 연결(Universal Link)과 같은 도메인이다. */
const inviteWebOrigin = 'https://talkhugam.vercel.app'

/** 현재 로그인한 회원의 책방 역할을 서버 RPC로 읽고, 활성 멤버가 아니면 null을 반환한다. */
export async function getMobileMyRoomRole(
  client: SupabaseClient,
  roomId: string,
): Promise<RoomRole | null> {
  const response = await client.rpc('get_my_room_role', { p_room_id: roomId })
  if (response.error) throw response.error
  return parseRoomRole(response.data)
}

/** 현재 멤버가 방장·운영자에게 책방 초대를 요청하고, 새 요청이면 true를 반환한다. */
export async function requestMobileRoomInvite(
  client: SupabaseClient,
  roomId: string,
): Promise<boolean> {
  const response = await client.rpc('request_room_invite', { p_room_id: roomId })
  if (response.error) throw response.error
  return z.boolean().parse(response.data)
}

/** 일회용 초대 코드와 토큰을 받아 기기 공유 창에 넘길 초대 문구와 참여 링크를 만든다. */
export function createMobileInviteShareMessage(invite: { code: string; token: string }): string {
  const url = new URL(`/rooms/join?invite=${invite.token}`, inviteWebOrigin).toString()
  return `책방에 초대해요.\n초대 코드: ${invite.code}\nTalk후감에서 코드를 입력해 함께 읽기 시작해요.\n${url}`
}
