import { describe, expect, it } from 'vitest'

import {
  formatRoomMemberSummary,
  formatRoomMessagePreview,
  mapReadingRoomsWithMembers,
  parseReadingRoomMembers,
  parseReadingRoomSummaries,
  parseReadingRooms,
  readingRoomKeys,
} from './readingRoom'
import { readingRoomRowSchema } from './index'

const roomId = 'f17c0d6d-3e6e-4b7f-a1f1-5d652aa2a85e'
const createdAt = '2026-07-17T02:01:30.123+00:00'

describe('private reading-room domain', () => {
  it('maps validated room rows to the mobile and web domain model', () => {
    expect(
      parseReadingRooms([
        {
          created_at: createdAt,
          description: null,
          id: roomId,
          name: '금요일 아침 독서방',
          updated_at: createdAt,
        },
      ]),
    ).toEqual([
      {
        createdAt,
        description: null,
        id: roomId,
        lastMessage: null,
        members: [],
        name: '금요일 아침 독서방',
        updatedAt: createdAt,
      },
    ])
  })

  it('keeps the latest message in a room summary', () => {
    expect(
      parseReadingRoomSummaries([
        {
          created_at: createdAt,
          description: '이번 달 함께 읽는 책들',
          id: roomId,
          last_message_author_name: '수진',
          last_message_body: '여기가 좋더라',
          last_message_created_at: '2026-07-17T03:01:30.123+00:00',
          last_message_type: 'text',
          name: '금요일 아침 독서방',
          updated_at: createdAt,
        },
      ]),
    ).toMatchObject([
      {
        lastMessage: {
          authorName: '수진',
          body: '여기가 좋더라',
          createdAt: '2026-07-17T03:01:30.123+00:00',
          type: 'text',
        },
      },
    ])
  })

  it('attaches active member display names to their matching rooms', () => {
    const rooms = parseReadingRooms([
      {
        created_at: createdAt,
        description: null,
        id: roomId,
        name: '금요일 아침 독서방',
        updated_at: createdAt,
      },
    ])

    expect(
      mapReadingRoomsWithMembers(
        rooms,
        parseReadingRoomMembers([
          { joined_at: createdAt, room_display_name: '민규', room_id: roomId },
        ]),
      ),
    ).toMatchObject([{ members: [{ displayName: '민규', joinedAt: createdAt }] }])
  })

  it('formats the established private-room previews and member summaries', () => {
    const room = parseReadingRooms([
      {
        created_at: createdAt,
        description: '이번 달 함께 읽는 책들',
        id: roomId,
        name: '금요일 아침 독서방',
        updated_at: createdAt,
      },
    ])[0]

    expect(formatRoomMessagePreview(room)).toBe('이번 달 함께 읽는 책들')
    expect(
      formatRoomMemberSummary([
        { displayName: '민규', joinedAt: createdAt },
        { displayName: '수진', joinedAt: createdAt },
        { displayName: '명준', joinedAt: createdAt },
      ]),
    ).toBe('민규 · 수진 외 1명 · 3명')
  })

  it('provides the established room query key', () => {
    expect(readingRoomKeys.all).toEqual(['reading-rooms'])
    expect(readingRoomKeys.byProfile('00000000-0000-4000-8000-000000000001')).toEqual([
      'reading-rooms',
      '00000000-0000-4000-8000-000000000001',
    ])
  })

  it('exports the room row schema from the shared package boundary', () => {
    expect(readingRoomRowSchema.safeParse({ id: roomId }).success).toBe(false)
  })
})
