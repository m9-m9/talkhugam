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
  members: ReadingRoomMember[]
  name: string
  updatedAt: string
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

export async function getReadingRooms(client: SupabaseClient): Promise<ReadingRoom[]> {
  const roomsResponse = await client
    .from('reading_rooms')
    .select('id, name, description, created_at, updated_at')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })

  if (roomsResponse.error) throw roomsResponse.error

  const rooms = readingRoomsSchema.parse(roomsResponse.data)
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

function mapRoomsWithMembers(
  rooms: readonly z.infer<typeof readingRoomRowSchema>[],
  members: readonly z.infer<typeof roomMemberRowSchema>[],
): ReadingRoom[] {
  const membersByRoomId = new Map<string, ReadingRoomMember[]>()

  members.forEach((member) => {
    const roomMembers = membersByRoomId.get(member.room_id) ?? []
    roomMembers.push(mapReadingRoomMember(member))
    membersByRoomId.set(member.room_id, roomMembers)
  })

  return rooms.map((room) => mapReadingRoom(room, membersByRoomId.get(room.id) ?? []))
}

function mapReadingRoom(
  row: z.infer<typeof readingRoomRowSchema>,
  members: ReadingRoomMember[],
): ReadingRoom {
  return {
    createdAt: row.created_at,
    description: row.description,
    id: row.id,
    members,
    name: row.name,
    updatedAt: row.updated_at,
  }
}

function mapReadingRoomMember(row: z.infer<typeof roomMemberRowSchema>): ReadingRoomMember {
  return {
    displayName: row.room_display_name,
    joinedAt: row.joined_at,
  }
}
