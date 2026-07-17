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

export type ReadingRoom = {
  createdAt: string
  description: string | null
  id: string
  name: string
  updatedAt: string
}

export const readingRoomKeys = {
  all: ['reading-rooms'] as const,
}

export function parseReadingRooms(value: unknown): ReadingRoom[] {
  return readingRoomsSchema.parse(value).map(mapReadingRoom)
}

export async function getReadingRooms(client: SupabaseClient): Promise<ReadingRoom[]> {
  const response = await client
    .from('reading_rooms')
    .select('id, name, description, created_at, updated_at')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })

  if (response.error) throw response.error

  return parseReadingRooms(response.data)
}

function mapReadingRoom(row: z.infer<typeof readingRoomRowSchema>): ReadingRoom {
  return {
    createdAt: row.created_at,
    description: row.description,
    id: row.id,
    name: row.name,
    updatedAt: row.updated_at,
  }
}
