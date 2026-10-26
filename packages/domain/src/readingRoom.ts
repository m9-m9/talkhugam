import { z } from 'zod'

export const readingRoomRowSchema = z.object({
  created_at: z.string().datetime({ offset: true }),
  description: z.string().nullable(),
  id: z.string().uuid(),
  name: z.string().min(1).max(40),
  updated_at: z.string().datetime({ offset: true }),
})

const readingRoomsSchema = z.array(readingRoomRowSchema)

export const readingRoomSummaryRowSchema = readingRoomRowSchema.extend({
  last_message_author_name: z.string().min(1).max(30).nullable(),
  last_message_body: z.string().nullable(),
  last_message_created_at: z.string().datetime({ offset: true }).nullable(),
  last_message_type: z.enum(['text', 'video']).nullable(),
})

const readingRoomSummariesSchema = z.array(readingRoomSummaryRowSchema)

export const readingRoomMemberRowSchema = z.object({
  joined_at: z.string().datetime({ offset: true }),
  room_display_name: z.string().min(1).max(30),
  room_id: z.string().uuid(),
})

const readingRoomMembersSchema = z.array(readingRoomMemberRowSchema)

export type ReadingRoom = {
  createdAt: string
  description: string | null
  id: string
  lastMessage: RoomLastMessage | null
  members: ReadingRoomMember[]
  name: string
  updatedAt: string
}

export type RoomLastMessage = {
  authorName: string
  body: string | null
  createdAt: string
  type: 'text' | 'video'
}

export type ReadingRoomMember = {
  displayName: string
  joinedAt: string
}

export type ReadingRoomMemberRow = z.infer<typeof readingRoomMemberRowSchema>

export const readingRoomKeys = {
  all: ['reading-rooms'] as const,
  /** 회원별 비공개 책방 캐시를 다른 계정과 분리하는 키를 반환한다. */
  byProfile(profileId: string) {
    return [...this.all, profileId] as const
  },
}

/** 외부 입력을 검증해 책방 목록 도메인 모델로 변환해 반환한다. */
export function parseReadingRooms(value: unknown): ReadingRoom[] {
  return readingRoomsSchema.parse(value).map((room) => mapReadingRoom(room, []))
}

/** 외부 입력을 검증해 최근 메시지가 포함된 책방 목록으로 변환해 반환한다. */
export function parseReadingRoomSummaries(value: unknown): ReadingRoom[] {
  return readingRoomSummariesSchema.parse(value).map(mapReadingRoomSummary)
}

/** 외부 입력을 검증해 책방 멤버 원본 행 목록으로 변환해 반환한다. */
export function parseReadingRoomMembers(value: unknown): ReadingRoomMemberRow[] {
  return readingRoomMembersSchema.parse(value)
}

/** 책방과 멤버 원본 행을 결합해 멤버가 포함된 책방 목록을 반환한다. */
export function mapReadingRoomsWithMembers(
  rooms: readonly ReadingRoom[],
  members: readonly ReadingRoomMemberRow[],
): ReadingRoom[] {
  const membersByRoomId = new Map<string, ReadingRoomMember[]>()

  members.forEach((member) => {
    const roomMembers = membersByRoomId.get(member.room_id) ?? []
    roomMembers.push(mapReadingRoomMember(member))
    membersByRoomId.set(member.room_id, roomMembers)
  })

  return rooms.map((room) => ({ ...room, members: membersByRoomId.get(room.id) ?? [] }))
}

/** 책방 멤버를 화면에 표시할 짧은 요약 문구로 변환해 반환한다. */
export function formatRoomMemberSummary(members: readonly ReadingRoomMember[]): string {
  const displayNames = members.map((member) => member.displayName)
  const visibleNames = displayNames.slice(0, 2).join(' · ')
  const remainingCount = displayNames.length - 2

  if (remainingCount > 0) return `${visibleNames} 외 ${remainingCount}명 · ${displayNames.length}명`

  return `${visibleNames} · ${displayNames.length}명`
}

/** 책방 최근 메시지를 화면에 표시할 미리보기 문구로 변환해 반환한다. */
export function formatRoomMessagePreview(room: ReadingRoom): string {
  if (room.lastMessage === null) return room.description ?? '아직 첫 이야기를 기다리고 있어요.'
  if (room.lastMessage.type === 'video')
    return `${room.lastMessage.authorName}님이 영상을 남겼어요.`
  if (room.lastMessage.body === null) return `${room.lastMessage.authorName}님이 페이지를 남겼어요.`

  return `${room.lastMessage.authorName}: ${room.lastMessage.body}`
}

/** ISO 시각을 책방 목록의 시:분 형식으로 변환해 반환한다. */
export function formatRoomMessageTime(value: string | null): string | null {
  if (value === null) return null

  const date = new Date(value)
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

/** 검증된 책방 원본 행과 멤버를 화면용 도메인 모델로 변환해 반환한다. */
function mapReadingRoom(
  row: z.infer<typeof readingRoomRowSchema>,
  members: ReadingRoomMember[],
): ReadingRoom {
  return {
    createdAt: row.created_at,
    description: row.description,
    id: row.id,
    lastMessage: null,
    members,
    name: row.name,
    updatedAt: row.updated_at,
  }
}

/** 검증된 책방 요약 원본 행을 최근 메시지가 포함된 도메인 모델로 변환해 반환한다. */
function mapReadingRoomSummary(row: z.infer<typeof readingRoomSummaryRowSchema>): ReadingRoom {
  return {
    createdAt: row.created_at,
    description: row.description,
    id: row.id,
    lastMessage: mapRoomLastMessage(row),
    members: [],
    name: row.name,
    updatedAt: row.updated_at,
  }
}

/** 검증된 최근 메시지 원본 필드가 완전할 때만 메시지 도메인 모델로 변환해 반환한다. */
function mapRoomLastMessage(
  row: z.infer<typeof readingRoomSummaryRowSchema>,
): RoomLastMessage | null {
  if (row.last_message_author_name === null) return null
  if (row.last_message_created_at === null) return null
  if (row.last_message_type === null) return null

  return {
    authorName: row.last_message_author_name,
    body: row.last_message_body,
    createdAt: row.last_message_created_at,
    type: row.last_message_type,
  }
}

/** 검증된 책방 멤버 원본 행을 표시용 멤버 모델로 변환해 반환한다. */
function mapReadingRoomMember(row: ReadingRoomMemberRow): ReadingRoomMember {
  return {
    displayName: row.room_display_name,
    joinedAt: row.joined_at,
  }
}
