import { z } from 'zod'

const communityRoomRowSchema = z.object({
  access: z.enum(['public', 'password']),
  active_member_count: z.number().int().min(0).max(100),
  capacity: z.number().int().min(1).max(100),
  created_by: z.string().uuid(),
  description: z.string().nullable(),
  id: z.string().uuid(),
  is_following_creator: z.boolean(),
  name: z.string().min(1).max(40),
})

const communityRoomsSchema = z.array(communityRoomRowSchema)

const joinCommunityRoomResultSchema = z
  .array(
    z.object({
      joined: z.boolean(),
      member_id: z.string().uuid(),
      room_id: z.string().uuid(),
    }),
  )
  .length(1)

export const createCommunityRoomFormSchema = z
  .object({
    access: z.enum(['public', 'password']),
    capacity: z.number().int().min(1).max(100),
    description: z.string().max(500),
    name: z.string().trim().min(1).max(40),
    password: z.string(),
  })
  .superRefine((value, context) => {
    if (value.access === 'password' && (value.password.length < 8 || value.password.length > 72)) {
      context.addIssue({ code: 'custom', message: '비밀번호는 8~72자로 입력해 주세요.', path: ['password'] })
    }
    if (value.access === 'public' && value.password.length > 0) {
      context.addIssue({ code: 'custom', message: '공개 책방에는 비밀번호를 입력할 수 없어요.', path: ['password'] })
    }
  })

export const joinCommunityRoomFormSchema = z.object({ password: z.string().max(72) })

export type CommunityRoom = {
  access: 'public' | 'password'
  activeMemberCount: number
  capacity: number
  createdBy: string
  description: string | null
  id: string
  isFollowingCreator: boolean
  name: string
}

export type CreateCommunityRoomForm = z.infer<typeof createCommunityRoomFormSchema>
export type JoinCommunityRoomForm = z.infer<typeof joinCommunityRoomFormSchema>

export type JoinCommunityRoomResult = { joined: boolean; memberId: string; roomId: string }

export const communityKeys = {
  all: ['community-rooms'] as const,
  /** 오픈 책방 발견 목록의 캐시 키를 반환한다. */
  discovery: () => [...communityKeys.all, 'discovery'] as const,
  /** 특정 오픈 책방의 상세 캐시 키를 반환한다. */
  detail: (roomId: string) => [...communityKeys.all, 'detail', roomId] as const,
  /** 특정 오픈 책방 자유 채팅의 캐시 키를 반환한다. */
  messages: (roomId: string) => [...communityKeys.all, 'messages', roomId] as const,
}

/** 외부 RPC 목록을 검증해 오픈 책방 화면 모델 배열로 변환한다. */
export function parseCommunityRooms(value: unknown): CommunityRoom[] {
  return communityRoomsSchema.parse(value).map(mapCommunityRoom)
}

/** 외부 RPC의 단일 입장 결과를 검증해 도메인 모델로 변환한다. */
export function parseJoinCommunityRoomResult(value: unknown): JoinCommunityRoomResult {
  const result = joinCommunityRoomResultSchema.parse(value).at(0)
  if (!result) throw new Error('오픈 책방 참여 결과가 없어요.')
  return { joined: result.joined, memberId: result.member_id, roomId: result.room_id }
}

/** 검증된 오픈 책방 행을 UI가 사용할 camelCase 모델로 변환한다. */
function mapCommunityRoom(row: z.infer<typeof communityRoomRowSchema>): CommunityRoom {
  return {
    access: row.access,
    activeMemberCount: row.active_member_count,
    capacity: row.capacity,
    createdBy: row.created_by,
    description: row.description,
    id: row.id,
    isFollowingCreator: row.is_following_creator,
    name: row.name,
  }
}
