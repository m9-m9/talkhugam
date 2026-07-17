import { describe, expect, it } from 'vitest'

import {
  formatRoomMemberSummary,
  formatRoomMessagePreview,
  formatRoomMessageTime,
  parseReadingRooms,
  parseReadingRoomSummaries,
  readingRoomKeys,
} from './readingRoom'

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
        lastMessage: null,
        members: [],
        name: '금요일 아침 독서방',
        updatedAt: '2026-07-17T02:01:30.123+00:00',
      },
    ])
  })

  it('rejects rows that are not a valid domain shape', () => {
    expect(() => parseReadingRooms([{ id: 'not-a-uuid' }])).toThrow()
  })
})

describe('formatRoomMessagePreview', () => {
  const room = {
    createdAt: '2026-07-17T02:01:30.123+00:00',
    description: '이번 달 함께 읽는 책들',
    id: 'f17c0d6d-3e6e-4b7f-a1f1-5d652aa2a85e',
    members: [],
    name: '금요일 아침 독서 모임',
    updatedAt: '2026-07-17T02:01:30.123+00:00',
  }

  it('uses the latest text message instead of the room description', () => {
    expect(
      formatRoomMessagePreview({
        ...room,
        lastMessage: {
          authorName: '수진',
          body: '여기가 좋더라',
          createdAt: '2026-07-17T02:01:30.123+00:00',
          type: 'text',
        },
      }),
    ).toBe('수진: 여기가 좋더라')
  })

  it('uses a clear video message preview', () => {
    expect(
      formatRoomMessagePreview({
        ...room,
        lastMessage: {
          authorName: '민규',
          body: null,
          createdAt: '2026-07-17T02:01:30.123+00:00',
          type: 'video',
        },
      }),
    ).toBe('민규님이 영상을 남겼어요.')
  })

  it('keeps the room description for a room with no messages', () => {
    expect(formatRoomMessagePreview({ ...room, lastMessage: null })).toBe('이번 달 함께 읽는 책들')
  })
})

describe('parseReadingRoomSummaries', () => {
  it('maps the most recent incoming or outgoing message into the room model', () => {
    expect(
      parseReadingRoomSummaries([
        {
          created_at: '2026-07-17T02:01:30.123+00:00',
          description: '이번 달 함께 읽는 책들',
          id: 'f17c0d6d-3e6e-4b7f-a1f1-5d652aa2a85e',
          last_message_author_name: '수진',
          last_message_body: '여기가 좋더라',
          last_message_created_at: '2026-07-17T03:01:30.123+00:00',
          last_message_type: 'text',
          name: '금요일 아침 독서 모임',
          updated_at: '2026-07-17T02:01:30.123+00:00',
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
        members: [],
      },
    ])
  })
})

describe('formatRoomMessageTime', () => {
  it('formats a message time for the room list', () => {
    expect(formatRoomMessageTime('2026-07-17T02:01:30.123+00:00')).toMatch(/^\d{2}:\d{2}$/)
  })
})

describe('formatRoomMemberSummary', () => {
  it('shows the first two member names and the total member count', () => {
    expect(
      formatRoomMemberSummary([
        { displayName: '민규', joinedAt: '2026-07-17T02:01:30.123+00:00' },
        { displayName: '수진', joinedAt: '2026-07-17T02:02:30.123+00:00' },
        { displayName: '명준', joinedAt: '2026-07-17T02:03:30.123+00:00' },
      ]),
    ).toBe('민규 · 수진 외 1명 · 3명')
  })

  it('keeps the summary useful for a one-person room', () => {
    expect(
      formatRoomMemberSummary([{ displayName: '민규', joinedAt: '2026-07-17T02:01:30.123+00:00' }]),
    ).toBe('민규 · 1명')
  })
})

describe('readingRoomKeys', () => {
  it('provides a stable query key', () => {
    expect(readingRoomKeys.all).toEqual(['reading-rooms'])
  })
})
