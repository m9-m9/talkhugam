import { describe, expect, it, vi } from 'vitest'

import {
  createMobileCommunityRoom,
  getMobileCommunityMessages,
  getMobileCommunityRooms,
  joinMobileCommunityRoom,
  sendMobileCommunityMessage,
} from './mobileCommunity'

const roomId = '11111111-1111-4111-8111-111111111111'

/** RPC 호출만 기록하고 사전에 준비한 응답을 반환하는 테스트 Supabase 경계를 만든다. */
function createClient(responses: unknown[]) {
  const rpc = vi.fn().mockImplementation(() => Promise.resolve({ data: responses.shift(), error: null }))
  return { rpc }
}

describe('mobile community repository', () => {
  it('팔로우 우선 오픈 책방 발견 목록을 좁은 RPC로 조회한다', async () => {
    const client = createClient([
      [
        {
          access: 'public', active_member_count: 2, capacity: 10,
          created_by: '22222222-2222-4222-8222-222222222222', description: null, id: roomId,
          is_following_creator: true, name: '주말 독서회',
        },
      ],
    ])

    await expect(getMobileCommunityRooms(client as never)).resolves.toMatchObject([{ name: '주말 독서회' }])
    expect(client.rpc).toHaveBeenCalledWith('list_community_rooms', { p_limit: 20 })
  })

  it('비밀번호는 참여 RPC에만 전달하고 참여 결과를 반환한다', async () => {
    const client = createClient([[{ joined: true, member_id: '33333333-3333-4333-8333-333333333333', room_id: roomId }]])

    await expect(joinMobileCommunityRoom(client as never, roomId, '민규', 'safe-pass')).resolves.toMatchObject({ roomId })
    expect(client.rpc).toHaveBeenCalledWith('join_community_room', {
      p_password: 'safe-pass', p_room_display_name: '민규', p_room_id: roomId,
    })
  })

  it('생성·메시지 작성은 각각 허용된 RPC만 호출한다', async () => {
    const messageId = '44444444-4444-4444-8444-444444444444'
    const client = createClient([[{ member_id: '33333333-3333-4333-8333-333333333333', room_id: roomId }], messageId])

    await expect(createMobileCommunityRoom(client as never, '민규', {
      access: 'public', capacity: 10, description: '', name: '주말 독서회', password: '',
    })).resolves.toBe(roomId)
    await expect(sendMobileCommunityMessage(client as never, roomId, '반가워요')).resolves.toBe(messageId)
    expect(client.rpc).toHaveBeenNthCalledWith(1, 'create_community_room', expect.objectContaining({ p_name: '주말 독서회' }))
    expect(client.rpc).toHaveBeenNthCalledWith(2, 'send_community_message', { p_body: '반가워요', p_room_id: roomId })
  })

  it('자유 채팅 목록을 검증된 화면 모델로 변환한다', async () => {
    const client = createClient([[
      { body: '첫 인사', created_at: '2026-08-18T00:00:00.000Z', id: '44444444-4444-4444-8444-444444444444', sender_display_name: '민규', sender_member_id: '33333333-3333-4333-8333-333333333333', sender_role: 'member' },
    ]])

    await expect(getMobileCommunityMessages(client as never, roomId)).resolves.toEqual([
      expect.objectContaining({ body: '첫 인사', senderDisplayName: '민규', senderRole: 'member' }),
    ])
  })
})
