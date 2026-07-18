import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

const roomIdSchema = z.string().uuid()

const roomManagementRowSchema = z.object({
  created_by: z.string().uuid().nullable(),
  description: z.string().nullable(),
  id: roomIdSchema,
  name: z.string().min(1).max(40),
  status: z.enum(['active', 'archived', 'deleted']),
})

const roomManagementMemberRowSchema = z.object({
  id: z.string().uuid(),
  joined_at: z.string().datetime({ offset: true }),
  profile_id: z.string().uuid().nullable(),
  role: z.enum(['owner', 'member']),
  room_avatar_path: z.string().nullable(),
  room_display_name: z.string().min(1).max(30),
  room_id: roomIdSchema,
  status: z.literal('active'),
})

const roomInviteRowSchema = z.object({
  created_at: z.string().datetime({ offset: true }),
  expires_at: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
  max_uses: z.number().int().min(1).max(20).nullable(),
  revoked_at: z.string().datetime({ offset: true }).nullable(),
  use_count: z.number().int().min(0),
})

const archivedRoomRowSchema = z.object({
  archived_at: z.string().datetime({ offset: true }),
  description: z.string().nullable(),
  id: roomIdSchema,
  name: z.string().min(1).max(40),
})

const createdInviteRowSchema = z
  .array(
    z.object({
      code: z.string().length(6),
      expires_at: z.string().datetime({ offset: true }),
      invite_id: z.string().uuid(),
    }),
  )
  .length(1)

const updateRoomSchema = z.object({
  description: z.string().trim().max(120),
  name: z.string().trim().min(1).max(40),
})

const roomExitActionSchema = z.enum(['archive', 'delete'])

export type ArchivedRoom = {
  archivedAt: string
  description: string | null
  id: string
  name: string
}

export type ManagedRoomInvite = {
  createdAt: string
  expiresAt: string
  id: string
  maxUses: number | null
  revokedAt: string | null
  useCount: number
}

export type RoomManagement = {
  createdBy: string | null
  description: string | null
  id: string
  isCurrentUserOwner: boolean
  members: RoomManagementMember[]
  name: string
  status: 'active' | 'archived' | 'deleted'
}

export type RoomManagementMember = {
  avatarPath: string | null
  displayName: string
  id: string
  isCurrentUser: boolean
  joinedAt: string
  profileId: string | null
  role: 'owner' | 'member'
}

export type CreatedManagedRoomInvite = {
  code: string
  expiresAt: string
  id: string
}

export type UpdateManagedRoom = z.infer<typeof updateRoomSchema>

export const roomManagementKeys = {
  archive: ['room-management', 'archive'] as const,
  /** 특정 독서방의 관리 상세 데이터를 식별하는 쿼리 키를 반환한다. */
  detail: (roomId: string) => ['room-management', roomId] as const,
  /** 특정 독서방의 활성 초대 목록을 식별하는 쿼리 키를 반환한다. */
  invites: (roomId: string) => ['room-management', roomId, 'invites'] as const,
}

/** 방 관리 화면에 필요한 방과 활성 멤버 데이터를 도메인 모델로 변환한다. */
export function parseRoomManagement(
  roomValue: unknown,
  memberValue: unknown,
  currentProfileId: string,
): RoomManagement {
  const currentProfile = roomIdSchema.parse(currentProfileId)
  const room = roomManagementRowSchema.parse(roomValue)
  const members = z.array(roomManagementMemberRowSchema).parse(memberValue)

  return {
    createdBy: room.created_by,
    description: room.description,
    id: room.id,
    isCurrentUserOwner: members.some(
      (member) => member.profile_id === currentProfile && member.role === 'owner',
    ),
    members: members.map((member) => mapRoomManagementMember(member, currentProfile)),
    name: room.name,
    status: room.status,
  }
}

/** 방장이 볼 수 있는 초대 메타데이터를 도메인 모델로 변환한다. */
export function parseRoomInvites(value: unknown): ManagedRoomInvite[] {
  return z.array(roomInviteRowSchema).parse(value).map(mapRoomInvite)
}

/** 지난 독서방 목록 응답을 UI가 사용하는 아카이브 모델로 변환한다. */
export function parseArchivedRooms(value: unknown): ArchivedRoom[] {
  return z.array(archivedRoomRowSchema).parse(value).map(mapArchivedRoom)
}

/** 현재 사용자가 접근 가능한 방 관리 정보를 조회한다. */
export async function getRoomManagement(
  client: SupabaseClient,
  roomId: string,
  currentProfileId: string,
): Promise<RoomManagement | null> {
  const parsedRoomId = roomIdSchema.parse(roomId)
  const roomResponse = await client
    .from('reading_rooms')
    .select('id, name, description, status, created_by')
    .eq('id', parsedRoomId)
    .maybeSingle()

  if (roomResponse.error) throw roomResponse.error
  if (roomResponse.data === null) return null

  const membersResponse = await client
    .from('room_members')
    .select('id, room_id, profile_id, role, status, room_display_name, room_avatar_path, joined_at')
    .eq('room_id', parsedRoomId)
    .eq('status', 'active')
    .order('joined_at', { ascending: true })

  if (membersResponse.error) throw membersResponse.error
  return parseRoomManagement(roomResponse.data, membersResponse.data, currentProfileId)
}

/** 현재 사용자가 만들고 보관한 지난 독서방을 조회한다. */
export async function getArchivedRooms(client: SupabaseClient): Promise<ArchivedRoom[]> {
  const response = await client.rpc('get_my_archived_reading_rooms')

  if (response.error) throw response.error
  return parseArchivedRooms(response.data)
}

/** 방장이 새 초대 코드를 만들고, 한 번만 노출할 안전한 값을 반환한다. */
export async function createManagedRoomInvite(
  client: SupabaseClient,
  roomId: string,
): Promise<CreatedManagedRoomInvite> {
  const response = await client.rpc('create_room_invite', { p_room_id: roomIdSchema.parse(roomId) })

  if (response.error) throw response.error

  const invite = getSingleResult(createdInviteRowSchema.parse(response.data))
  return { code: invite.code, expiresAt: invite.expires_at, id: invite.invite_id }
}

/** 방장이 더 이상 쓰지 않을 초대 코드를 즉시 폐기한다. */
export async function revokeManagedRoomInvite(
  client: SupabaseClient,
  inviteId: string,
): Promise<void> {
  const response = await client.rpc('revoke_room_invite', {
    p_invite_id: roomIdSchema.parse(inviteId),
  })

  if (response.error) throw response.error
}

/** 방장이 현재 활성 멤버를 방에서 내보낸다. */
export async function removeManagedRoomMember(
  client: SupabaseClient,
  roomId: string,
  memberId: string,
): Promise<void> {
  const response = await client.rpc('remove_room_member', {
    p_room_id: roomIdSchema.parse(roomId),
    p_target_member_id: roomIdSchema.parse(memberId),
  })

  if (response.error) throw response.error
}

/** 방장이 다른 활성 멤버에게 방장 권한을 넘긴다. */
export async function transferManagedRoomOwnership(
  client: SupabaseClient,
  roomId: string,
  memberId: string,
): Promise<void> {
  const response = await client.rpc('transfer_room_ownership', {
    p_room_id: roomIdSchema.parse(roomId),
    p_target_member_id: roomIdSchema.parse(memberId),
  })

  if (response.error) throw response.error
}

/** 방장이 방 이름과 소개를 바꾼다. */
export async function updateManagedRoom(
  client: SupabaseClient,
  roomId: string,
  values: UpdateManagedRoom,
): Promise<void> {
  const room = updateRoomSchema.parse(values)
  const response = await client
    .from('reading_rooms')
    .update({ description: room.description || null, name: room.name })
    .eq('id', roomIdSchema.parse(roomId))

  if (response.error) throw response.error
}

/** 현재 사용자가 방을 나가며, 최종 방장일 때의 보관 또는 삭제 선택을 전달한다. */
export async function leaveManagedRoom(
  client: SupabaseClient,
  roomId: string,
  finalOwnerAction: 'archive' | 'delete' | null,
): Promise<void> {
  const action = finalOwnerAction === null ? null : roomExitActionSchema.parse(finalOwnerAction)
  const response = await client.rpc('leave_room', {
    p_last_owner_action: action,
    p_room_id: roomIdSchema.parse(roomId),
  })

  if (response.error) throw response.error
}

/** 원본 멤버 행을 방 관리 화면 전용 멤버 모델로 변환한다. */
function mapRoomManagementMember(
  row: z.infer<typeof roomManagementMemberRowSchema>,
  currentProfileId: string,
): RoomManagementMember {
  return {
    avatarPath: row.room_avatar_path,
    displayName: row.room_display_name,
    id: row.id,
    isCurrentUser: row.profile_id === currentProfileId,
    joinedAt: row.joined_at,
    profileId: row.profile_id,
    role: row.role,
  }
}

/** 원본 초대 행을 초대 관리 화면 전용 모델로 변환한다. */
function mapRoomInvite(row: z.infer<typeof roomInviteRowSchema>): ManagedRoomInvite {
  return {
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    id: row.id,
    maxUses: row.max_uses,
    revokedAt: row.revoked_at,
    useCount: row.use_count,
  }
}

/** 원본 아카이브 행을 UI 전용 모델로 변환한다. */
function mapArchivedRoom(row: z.infer<typeof archivedRoomRowSchema>): ArchivedRoom {
  return {
    archivedAt: row.archived_at,
    description: row.description,
    id: row.id,
    name: row.name,
  }
}

/** RPC 배열 응답에서 정확히 한 행을 안전하게 꺼낸다. */
function getSingleResult<T>(rows: readonly T[]): T {
  const result = rows.at(0)
  if (result === undefined) throw new Error('RPC returned no result')

  return result
}
