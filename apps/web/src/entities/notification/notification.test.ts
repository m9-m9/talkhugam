import { describe, expect, it } from 'vitest'

import { createNotificationReadPayload, parseNotifications } from './notification'

const ids = {
  bookChat: '11111111-1111-4111-8111-111111111111',
  notification: '22222222-2222-4222-8222-222222222222',
  room: '33333333-3333-4333-8333-333333333333',
}

describe('알림 도메인 변환', () => {
  it('책 활동 알림을 해당 책 대화 경로와 한국어 문구로 변환한다', () => {
    expect(
      parseNotifications([
        {
          actor: { room_display_name: '수진' },
          book_chat_id: ids.bookChat,
          created_at: '2026-07-18T01:02:03.000Z',
          id: ids.notification,
          post: null,
          post_id: null,
          read_at: null,
          room: { name: '금요일 아침 책방' },
          room_id: ids.room,
          type: 'video',
        },
        {
          actor: { room_display_name: '민주' },
          book_chat_id: ids.bookChat,
          created_at: '2026-07-18T01:02:04.000Z',
          id: '44444444-4444-4444-8444-444444444444',
          post: null,
          post_id: null,
          read_at: null,
          room: { name: '금요일 아침 책방' },
          room_id: ids.room,
          type: 'completion',
        },
      ]),
    ).toMatchObject([
      {
        message: '수진님이 새 영상 기록을 남겼어요.',
        targetPath: `/rooms/${ids.room}/books/${ids.bookChat}`,
        type: 'video',
      },
      {
        message: '민주님이 완독 기록을 남겼어요.',
        targetPath: `/rooms/${ids.room}/books/${ids.bookChat}`,
        type: 'completion',
      },
    ])
  })

  it('연결 정보가 없는 알림도 안전하게 화면 모델로 변환한다', () => {
    expect(
      parseNotifications([
        {
          actor: null,
          created_at: '2026-07-18T01:02:03.000Z',
          id: ids.notification,
          post: null,
          post_id: null,
          read_at: null,
          room: null,
          room_id: null,
          type: 'system',
        },
      ]),
    ).toEqual([
      {
        actorName: null,
        createdAt: '2026-07-18T01:02:03.000Z',
        id: ids.notification,
        isRead: false,
        message: '새 알림이 도착했어요.',
        roomName: null,
        targetPath: null,
        type: 'system',
      },
    ])
  })

  it('답글 알림을 해당 책 대화 경로로 변환한다', () => {
    expect(
      parseNotifications([
        {
          actor: { room_display_name: '수진' },
          created_at: '2026-07-18T01:02:03.000Z',
          id: ids.notification,
          post: { book_chat_id: ids.bookChat },
          post_id: ids.notification,
          read_at: '2026-07-18T01:03:03.000Z',
          room: { name: '금요일 아침 독서 모임' },
          room_id: ids.room,
          type: 'reply',
        },
      ]),
    ).toMatchObject([
      {
        actorName: '수진',
        isRead: true,
        message: '수진님이 답글을 남겼어요.',
        roomName: '금요일 아침 독서 모임',
        targetPath: `/rooms/${ids.room}/books/${ids.bookChat}`,
      },
    ])
  })

  it('초대 요청 알림을 방 관리 화면으로 연결한다', () => {
    expect(
      parseNotifications([
        {
          actor: { room_display_name: '수진' },
          created_at: '2026-07-18T01:02:03.000Z',
          id: ids.notification,
          post: null,
          post_id: null,
          read_at: null,
          room: { name: '금요일 아침 책방' },
          room_id: ids.room,
          type: 'invite_request',
        },
      ]),
    ).toMatchObject([
      {
        message: '수진님이 책방 초대를 요청했어요.',
        targetPath: `/rooms/${ids.room}/manage`,
        type: 'invite_request',
      },
    ])
  })

  it('읽을 수 없는 독서방의 알림은 원본 room_id가 있어도 이동 경로를 만들지 않는다', () => {
    expect(
      parseNotifications([
        {
          actor: null,
          created_at: '2026-07-18T01:02:03.000Z',
          id: ids.notification,
          post: null,
          post_id: null,
          read_at: null,
          room: null,
          room_id: ids.room,
          type: 'removed',
        },
      ]),
    ).toMatchObject([{ roomName: null, targetPath: null }])
  })
})

describe('읽음 처리 요청 값', () => {
  it('개별 알림 읽음 처리를 위한 RPC payload를 만든다', () => {
    expect(createNotificationReadPayload({ ids: [ids.notification] })).toEqual({
      p_notification_ids: [ids.notification],
      p_read_all_before: null,
    })
  })

  it('최신 알림 시각까지 전체 읽음 처리를 위한 RPC payload를 만든다', () => {
    expect(createNotificationReadPayload({ readAllBefore: '2026-07-18T01:02:03.000Z' })).toEqual({
      p_notification_ids: null,
      p_read_all_before: '2026-07-18T01:02:03.000Z',
    })
  })
})
