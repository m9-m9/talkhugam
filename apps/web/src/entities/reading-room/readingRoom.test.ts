import { describe, expect, it } from 'vitest'

import { parseReadingRooms, readingRoomKeys } from './readingRoom'

describe('parseReadingRooms', () => {
  it('maps Supabase rows to reading-room domain models', () => {
    expect(
      parseReadingRooms([
        {
          created_at: '2026-07-17T02:01:30.123+00:00',
          description: null,
          id: 'f17c0d6d-3e6e-4b7f-a1f1-5d652aa2a85e',
          name: '금요일 아침 독서방',
          updated_at: '2026-07-17T02:01:30.123+00:00',
        },
      ]),
    ).toEqual([
      {
        createdAt: '2026-07-17T02:01:30.123+00:00',
        description: null,
        id: 'f17c0d6d-3e6e-4b7f-a1f1-5d652aa2a85e',
        name: '금요일 아침 독서방',
        updatedAt: '2026-07-17T02:01:30.123+00:00',
      },
    ])
  })

  it('rejects rows that are not a valid domain shape', () => {
    expect(() => parseReadingRooms([{ id: 'not-a-uuid' }])).toThrow()
  })
})

describe('readingRoomKeys', () => {
  it('provides a stable query key', () => {
    expect(readingRoomKeys.all).toEqual(['reading-rooms'])
  })
})
