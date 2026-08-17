import type { SupabaseClient } from '@supabase/supabase-js'
import {
  formatRoomMemberSummary,
  formatRoomMessagePreview,
  formatRoomMessageTime,
  mapReadingRoomsWithMembers,
  parseReadingRoomMembers,
  parseReadingRoomSummaries,
  parseReadingRooms,
  readingRoomKeys,
  type ReadingRoom,
} from '@talkhugam/domain'

export {
  formatRoomMemberSummary,
  formatRoomMessagePreview,
  formatRoomMessageTime,
  parseReadingRooms,
  parseReadingRoomSummaries,
  readingRoomKeys,
}
export type { ReadingRoom, ReadingRoomMember, RoomLastMessage } from '@talkhugam/domain'

/** 현재 사용자가 참여한 책방과 활성 멤버 목록을 조회해 반환한다. */
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

  return mapReadingRoomsWithMembers(rooms, parseReadingRoomMembers(membersResponse.data))
}
