import { describe, expect, it, vi } from 'vitest'

import { getMobileReadingRooms } from './mobileReadingRoom'

const roomId = '00000000-0000-4000-8000-000000000001'

describe('getMobileReadingRooms', () => {
  it('reads the member-scoped room summary RPC before requesting active member labels', async () => {
    const activeMembers = {
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            joined_at: '2026-08-18T01:00:00.000Z',
            room_display_name: '민규',
            room_id: roomId,
          },
        ],
        error: null,
      }),
      select: vi.fn().mockReturnThis(),
    }
    const client = {
      from: vi.fn().mockReturnValue(activeMembers),
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            created_at: '2026-08-18T00:00:00.000Z',
            description: '이번 달 함께 읽는 책들',
            id: roomId,
            last_message_author_name: null,
            last_message_body: null,
            last_message_created_at: null,
            last_message_type: null,
            name: '금요일 아침 책방',
            updated_at: '2026-08-18T00:00:00.000Z',
          },
        ],
        error: null,
      }),
    }

    await expect(getMobileReadingRooms(client as never)).resolves.toEqual([
      expect.objectContaining({
        id: roomId,
        members: [{ displayName: '민규', joinedAt: '2026-08-18T01:00:00.000Z' }],
        name: '금요일 아침 책방',
      }),
    ])
    expect(client.rpc).toHaveBeenCalledWith('get_my_reading_room_summaries')
    expect(activeMembers.eq).toHaveBeenCalledWith('status', 'active')
  })

  it('does not query the room members table when the protected summary RPC returns no rooms', async () => {
    const client = {
      from: vi.fn(),
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    }

    await expect(getMobileReadingRooms(client as never)).resolves.toEqual([])
    expect(client.from).not.toHaveBeenCalled()
  })
})
