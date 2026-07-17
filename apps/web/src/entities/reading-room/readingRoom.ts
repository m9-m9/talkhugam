import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

const readingRoomRowSchema = z.object({
  created_at: z.string().datetime({ offset: true }),
  description: z.string().nullable(),
  id: z.string().uuid(),
  name: z.string().min(1).max(40),
  updated_at: z.string().datetime({ offset: true }),
})

const readingRoomsSchema = z.array(readingRoomRowSchema)

const readingRoomSummaryRowSchema = readingRoomRowSchema.extend({
  last_message_author_name: z.string().min(1).max(30).nullable(),
  last_message_body: z.string().nullable(),
  last_message_created_at: z.string().datetime({ offset: true }).nullable(),
  last_message_type: z.enum(['text', 'video']).nullable(),
})

const readingRoomSummariesSchema = z.array(readingRoomSummaryRowSchema)

const roomMemberRowSchema = z.object({
  joined_at: z.string().datetime({ offset: true }),
  room_display_name: z.string().min(1).max(30),
  room_id: z.string().uuid(),
})

const roomMembersSchema = z.array(roomMemberRowSchema)

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

export const readingRoomKeys = {
  all: ['reading-rooms'] as const,
}

export function parseReadingRooms(value: unknown): ReadingRoom[] {
  return readingRoomsSchema.parse(value).map((room) => mapReadingRoom(room, []))
}

export function parseReadingRoomSummaries(value: unknown): ReadingRoom[] {
  return readingRoomSummariesSchema.parse(value).map(mapReadingRoomSummary)
}

export async function getReadingRooms(client: SupabaseClient): Promise<ReadingRoom[]> {
  const roomsResponse = await client.rpc('get_my_reading_room_summaries')

  if (roomsResponse.error) throw roomsResponse.error

  const rooms = parseReadingRoomSummaries(roomsResponse.data)
  if (rooms.length === 0) return []

  const membersResponse = await client
    .from('room_members')
    .select('room_id, room_display_name, joined_at')
    .in(
      'room_id',
      rooms.map((room) => room.id),
    )
    .eq('status', 'active')
    .order('joined_at', { ascending: true })

  if (membersResponse.error) throw membersResponse.error

  return mapRoomsWithMembers(rooms, roomMembersSchema.parse(membersResponse.data))
}

export function formatRoomMemberSummary(members: readonly ReadingRoomMember[]): string {
  const displayNames = members.map((member) => member.displayName)
  const visibleNames = displayNames.slice(0, 2).join(' · ')
  const remainingCount = displayNames.length - 2

  if (remainingCount > 0) return `${visibleNames} 외 ${remainingCount}명 · ${displayNames.length}명`

  return `${visibleNames} · ${displayNames.length}명`
}

export function formatRoomMessagePreview(room: ReadingRoom): string {
  if (room.lastMessage === null) return room.description ?? '아직 첫 이야기를 기다리고 있어요.'
  if (room.lastMessage.type === 'video')
    return `${room.lastMessage.authorName}님이 영상을 남겼어요.`
  if (room.lastMessage.body === null) return `${room.lastMessage.authorName}님이 페이지를 남겼어요.`

  return `${room.lastMessage.authorName}: ${room.lastMessage.body}`
}

export function formatRoomMessageTime(value: string | null): string | null {
  if (value === null) return null

  const date = new Date(value)
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

function mapRoomsWithMembers(
  rooms: readonly ReadingRoom[],
  members: readonly z.infer<typeof roomMemberRowSchema>[],
): ReadingRoom[] {
  const membersByRoomId = new Map<string, ReadingRoomMember[]>()

  members.forEach((member) => {
    const roomMembers = membersByRoomId.get(member.room_id) ?? []
    roomMembers.push(mapReadingRoomMember(member))
    membersByRoomId.set(member.room_id, roomMembers)
  })

  return rooms.map((room) => ({ ...room, members: membersByRoomId.get(room.id) ?? [] }))
}

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

function mapReadingRoomMember(row: z.infer<typeof roomMemberRowSchema>): ReadingRoomMember {
  return {
    displayName: row.room_display_name,
    joinedAt: row.joined_at,
  }
}
