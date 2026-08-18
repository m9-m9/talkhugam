import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createCommunityRoomFormSchema,
  parseCommunityRooms,
  parseJoinCommunityRoomResult,
  communityKeys,
  type CommunityRoom,
  type CreateCommunityRoomForm,
  type JoinCommunityRoomResult,
} from '@talkhugam/domain'
import { z } from 'zod'

const createCommunityRoomResultSchema = z
  .array(z.object({ member_id: z.string().uuid(), room_id: z.string().uuid() }))
  .length(1)
const communityDetailSchema = z
  .array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      description: z.string().nullable(),
      current_member_id: z.string().uuid(),
      is_owner: z.boolean(),
    }),
  )
  .length(1)
const communityMessagesSchema = z.array(
  z.object({
    id: z.string().uuid(),
    body: z.string(),
    created_at: z.string().datetime({ offset: true }),
    sender_member_id: z.string().uuid(),
    sender_display_name: z.string(),
  }),
)
const contentReportStatusSchema = z.enum(['open', 'reviewing', 'resolved', 'dismissed'])
const contentReportActionSchema = z.object({
  createdAt: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
  nextStatus: contentReportStatusSchema,
  operatorProfileId: z.string().uuid(),
  previousStatus: contentReportStatusSchema,
  resolutionNote: z.string().nullable(),
})
const adminContentReportSchema = z.object({
  actions: z.array(contentReportActionSchema),
  created_at: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
  reason: z.string().min(1).max(500),
  reporter_profile_id: z.string().uuid(),
  resolution_note: z.string().nullable(),
  resolved_at: z.string().datetime({ offset: true }).nullable(),
  resolved_by: z.string().uuid().nullable(),
  status: contentReportStatusSchema,
  target_id: z.string().uuid(),
  target_type: z.enum(['room', 'profile', 'community_message']),
})
const adminContentReportUpdateSchema = adminContentReportSchema.omit({ actions: true })

export { communityKeys, createCommunityRoomFormSchema, parseCommunityRooms }
export type { CommunityRoom, CreateCommunityRoomForm, JoinCommunityRoomResult }
export type CommunityDetail = {
  id: string
  name: string
  description: string | null
  currentMemberId: string
  isOwner: boolean
}
export type CommunityMessage = {
  id: string
  body: string
  createdAt: string
  senderMemberId: string
  senderDisplayName: string
}
export type ContentReportStatus = z.infer<typeof contentReportStatusSchema>
export type AdminContentReportAction = z.infer<typeof contentReportActionSchema>
export type AdminContentReport = {
  actions: AdminContentReportAction[]
  createdAt: string
  id: string
  reason: string
  reporterProfileId: string
  resolutionNote: string | null
  resolvedAt: string | null
  resolvedBy: string | null
  status: ContentReportStatus
  targetId: string
  targetType: 'room' | 'profile' | 'community_message'
}

/** 오픈 책방 발견 목록을 팔로우 생성자 우선순위 그대로 조회한다. */
export async function getCommunityRooms(client: SupabaseClient): Promise<CommunityRoom[]> {
  const response = await client.rpc('list_community_rooms', { p_limit: 20 })
  if (response.error) throw response.error
  return parseCommunityRooms(response.data)
}

/** 활성 멤버에게 허용된 오픈 책방 상세와 본인 방장 권한을 조회한다. */
export async function getCommunityRoom(
  client: SupabaseClient,
  roomId: string,
): Promise<CommunityDetail> {
  const response = await client.rpc('get_community_room', { p_room_id: roomId })
  if (response.error) throw response.error
  const room = communityDetailSchema.parse(response.data).at(0)
  if (!room) throw new Error('오픈 책방을 찾을 수 없어요.')
  return {
    currentMemberId: room.current_member_id,
    description: room.description,
    id: room.id,
    isOwner: room.is_owner,
    name: room.name,
  }
}

/** 활성 멤버에게 허용된 자유 채팅 메시지를 최근 순서로 조회한다. */
export async function getCommunityMessages(
  client: SupabaseClient,
  roomId: string,
): Promise<CommunityMessage[]> {
  const response = await client.rpc('list_community_messages', { p_limit: 100, p_room_id: roomId })
  if (response.error) throw response.error
  return communityMessagesSchema.parse(response.data).map((message) => ({
    body: message.body,
    createdAt: message.created_at,
    id: message.id,
    senderDisplayName: message.sender_display_name,
    senderMemberId: message.sender_member_id,
  }))
}

/** 현재 사용자를 방장으로 하는 오픈 책방을 만들고 방 식별자를 반환한다. */
export async function createCommunityRoom(
  client: SupabaseClient,
  roomDisplayName: string,
  values: CreateCommunityRoomForm,
): Promise<string> {
  const response = await client.rpc('create_community_room', {
    p_access: values.access,
    p_capacity: values.capacity,
    p_description: values.description,
    p_name: values.name,
    p_password: values.access === 'password' ? values.password : null,
    p_room_display_name: roomDisplayName,
  })
  if (response.error) throw response.error
  const result = createCommunityRoomResultSchema.parse(response.data).at(0)
  if (!result) throw new Error('오픈 책방 생성 결과가 없어요.')
  return result.room_id
}

/** 공개 또는 비밀번호 오픈 책방에 현재 사용자를 참여시키고 결과를 반환한다. */
export async function joinCommunityRoom(
  client: SupabaseClient,
  roomId: string,
  roomDisplayName: string,
  password: string,
): Promise<JoinCommunityRoomResult> {
  const response = await client.rpc('join_community_room', {
    p_password: password || null,
    p_room_display_name: roomDisplayName,
    p_room_id: roomId,
  })
  if (response.error) throw response.error
  return parseJoinCommunityRoomResult(response.data)
}

/** 활성 오픈 책방 멤버로서 자유 채팅 메시지를 작성하고 식별자를 반환한다. */
export async function sendCommunityMessage(
  client: SupabaseClient,
  roomId: string,
  body: string,
): Promise<string> {
  const response = await client.rpc('send_community_message', { p_body: body, p_room_id: roomId })
  if (response.error) throw response.error
  return z.string().uuid().parse(response.data)
}

/** 오픈 책방 방장이 대상 활성 멤버를 퇴장시키고 재입장을 금지한다. */
export async function banCommunityMember(
  client: SupabaseClient,
  roomId: string,
  targetMemberId: string,
): Promise<void> {
  const response = await client.rpc('ban_community_member', {
    p_room_id: roomId,
    p_target_member_id: targetMemberId,
  })
  if (response.error) throw response.error
}

/** 접근 가능한 방·프로필·자유 채팅을 운영자에게 신고하고 신고 식별자를 반환한다. */
export async function reportCommunityTarget(
  client: SupabaseClient,
  targetType: 'room' | 'profile' | 'community_message',
  targetId: string,
  reason: string,
): Promise<string> {
  const response = await client.rpc('create_content_report', {
    p_reason: reason,
    p_target_id: targetId,
    p_target_type: targetType,
  })
  if (response.error) throw response.error
  return z.string().uuid().parse(response.data)
}

/** 운영자 권한을 가진 현재 사용자에게만 신고 원본과 조치 이력 목록을 반환한다. */
export async function listAdminContentReports(
  client: SupabaseClient,
  status?: ContentReportStatus,
): Promise<AdminContentReport[]> {
  const response = await client.rpc('list_content_reports', { p_status: status ?? null })
  if (response.error) throw response.error
  return z.array(adminContentReportSchema).parse(response.data).map(mapAdminContentReport)
}

/** 운영자만 신고 상태와 종결 메모를 저장하고 변경된 신고를 반환한다. */
export async function updateAdminContentReport(
  client: SupabaseClient,
  reportId: string,
  status: ContentReportStatus,
  resolutionNote: string,
): Promise<Omit<AdminContentReport, 'actions'>> {
  const response = await client.rpc('update_content_report', {
    p_report_id: reportId,
    p_resolution_note: resolutionNote || null,
    p_status: status,
  })
  if (response.error) throw response.error
  const report = z.array(adminContentReportUpdateSchema).length(1).parse(response.data).at(0)
  if (!report) throw new Error('신고 처리 결과가 없어요.')
  return mapAdminContentReport({ ...report, actions: [] })
}

/** 운영자 RPC의 snake_case 신고 원본을 화면 전용 camelCase 모델로 변환한다. */
function mapAdminContentReport(
  report: z.infer<typeof adminContentReportSchema>,
): AdminContentReport {
  return {
    actions: report.actions,
    createdAt: report.created_at,
    id: report.id,
    reason: report.reason,
    reporterProfileId: report.reporter_profile_id,
    resolutionNote: report.resolution_note,
    resolvedAt: report.resolved_at,
    resolvedBy: report.resolved_by,
    status: report.status,
    targetId: report.target_id,
    targetType: report.target_type,
  }
}
