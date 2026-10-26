import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createCommunityRoomFormSchema,
  parseCommunityRooms,
  parseJoinCommunityRoomResult,
  roomRoleSchema,
  type CommunityRoom,
  type CreateCommunityRoomForm,
  type JoinCommunityRoomResult,
  type RoomRole,
} from '@talkhugam/domain'
import { z } from 'zod'

const createdRoomSchema = z.array(z.object({ room_id: z.string().uuid() })).length(1)
const communityDetailSchema = z
  .array(z.object({ current_member_id: z.string().uuid(), current_member_role: roomRoleSchema, description: z.string().nullable(), id: z.string().uuid(), is_owner: z.boolean(), name: z.string() }))
  .length(1)
const messagesSchema = z.array(z.object({ body: z.string(), created_at: z.string().datetime({ offset: true }), id: z.string().uuid(), sender_display_name: z.string(), sender_member_id: z.string().uuid(), sender_role: roomRoleSchema }))

export type MobileCommunityDetail = { currentMemberId: string; currentMemberRole: RoomRole; description: string | null; id: string; isOwner: boolean; name: string }
export type MobileCommunityMessage = { body: string; createdAt: string; id: string; senderDisplayName: string; senderMemberId: string; senderRole: RoomRole }

/** 로그인한 회원이 참여할 수 있는 오픈 책방 발견 목록을 팔로우 우선순위로 조회한다. */
export async function getMobileCommunityRooms(client: SupabaseClient): Promise<CommunityRoom[]> {
  const response = await client.rpc('list_community_rooms', { p_limit: 20 })
  if (response.error) throw response.error
  return parseCommunityRooms(response.data)
}

/** 활성 멤버에게 허용된 오픈 책방 상세와 현재 회원의 책방 역할을 반환한다. */
export async function getMobileCommunityRoom(client: SupabaseClient, roomId: string): Promise<MobileCommunityDetail> {
  const response = await client.rpc('get_community_room', { p_room_id: roomId })
  if (response.error) throw response.error
  const room = communityDetailSchema.parse(response.data).at(0)
  if (!room) throw new Error('오픈 책방을 찾을 수 없어요.')
  return { currentMemberId: room.current_member_id, currentMemberRole: room.current_member_role, description: room.description, id: room.id, isOwner: room.is_owner, name: room.name }
}

/** 활성 멤버에게만 허용된 자유 채팅을 보낸 사람 역할과 함께 반환한다. */
export async function getMobileCommunityMessages(client: SupabaseClient, roomId: string): Promise<MobileCommunityMessage[]> {
  const response = await client.rpc('list_community_messages', { p_limit: 100, p_room_id: roomId })
  if (response.error) throw response.error
  return messagesSchema.parse(response.data).map((message) => ({ body: message.body, createdAt: message.created_at, id: message.id, senderDisplayName: message.sender_display_name, senderMemberId: message.sender_member_id, senderRole: message.sender_role }))
}

/** 현재 프로필 표시 이름으로 공개 또는 비밀번호 오픈 책방을 만들고 방 식별자를 반환한다. */
export async function createMobileCommunityRoom(client: SupabaseClient, roomDisplayName: string, input: unknown): Promise<string> {
  const values = createCommunityRoomFormSchema.parse(input)
  const response = await client.rpc('create_community_room', { p_access: values.access, p_capacity: values.capacity, p_description: values.description, p_name: values.name, p_password: values.access === 'password' ? values.password : null, p_room_display_name: roomDisplayName })
  if (response.error) throw response.error
  const result = createdRoomSchema.parse(response.data).at(0)
  if (!result) throw new Error('오픈 책방 생성 결과가 없어요.')
  return result.room_id
}

/** 현재 프로필 표시 이름과 일회성 입력 비밀번호로 오픈 책방 참여를 요청한다. */
export async function joinMobileCommunityRoom(client: SupabaseClient, roomId: string, roomDisplayName: string, password: string): Promise<JoinCommunityRoomResult> {
  const response = await client.rpc('join_community_room', { p_password: password || null, p_room_display_name: roomDisplayName, p_room_id: roomId })
  if (response.error) throw response.error
  return parseJoinCommunityRoomResult(response.data)
}

/** 활성 오픈 책방 멤버가 2,000자 이내의 자유 채팅을 작성하고 식별자를 반환한다. */
export async function sendMobileCommunityMessage(client: SupabaseClient, roomId: string, body: string): Promise<string> {
  const response = await client.rpc('send_community_message', { p_body: body, p_room_id: roomId })
  if (response.error) throw response.error
  return z.string().uuid().parse(response.data)
}

/** 방장 권한으로 대상 멤버를 퇴장·재입장 금지 처리한다. */
export async function banMobileCommunityMember(client: SupabaseClient, roomId: string, targetMemberId: string): Promise<void> {
  const response = await client.rpc('ban_community_member', { p_room_id: roomId, p_target_member_id: targetMemberId })
  if (response.error) throw response.error
}

/** 접근 가능한 방·프로필·메시지를 운영자 검토 대상으로 신고하고 식별자를 반환한다. */
export async function reportMobileCommunityTarget(client: SupabaseClient, targetType: 'room' | 'profile' | 'community_message', targetId: string, reason: string): Promise<string> {
  const response = await client.rpc('create_content_report', { p_reason: reason, p_target_id: targetId, p_target_type: targetType })
  if (response.error) throw response.error
  return z.string().uuid().parse(response.data)
}

export type { CommunityRoom, CreateCommunityRoomForm }
