import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapReadingRoomsWithMembers,
  parseReadingRoomMembers,
  parseReadingRoomSummaries,
  type ReadingRoom,
} from '@talkhugam/domain'

/** 현재 회원에게 허용된 책방 요약과 활성 멤버 표시명을 결합해 반환한다. */
export async function getMobileReadingRooms(client: SupabaseClient): Promise<ReadingRoom[]> {
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
