import { describe, expect, it, vi } from 'vitest'

import {
  banCommunityMember,
  createCommunityRoom,
  getCommunityMessages,
  getCommunityRoom,
  getCommunityRooms,
  joinCommunityRoom,
  listAdminContentReports,
  reportCommunityTarget,
  sendCommunityMessage,
  updateAdminContentReport,
} from './community'

const roomId = '22222222-2222-4222-8222-222222222222'

/** 커뮤니티 RPC 호출만 허용하는 Supabase 테스트 경계를 생성한다. */
function createClient(response: unknown = { data: [], error: null }) {
  return { rpc: vi.fn().mockResolvedValue(response) }
}

describe('community repository', () => {
  it('오픈 책방 상세와 자유 채팅에서 역할을 함께 읽는다', async () => {
    const memberId = '33333333-3333-4333-8333-333333333333'
    const client = createClient()
    client.rpc
      .mockResolvedValueOnce({
        data: [
          {
            current_member_id: memberId,
            current_member_role: 'manager',
            description: null,
            id: roomId,
            is_owner: false,
            name: '밤 독서회',
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            body: '반가워요',
            created_at: '2026-10-27T00:00:00.000Z',
            id: '44444444-4444-4444-8444-444444444444',
            sender_display_name: '참여자',
            sender_member_id: '55555555-5555-4555-8555-555555555555',
            sender_role: 'member',
          },
        ],
        error: null,
      })

    await expect(getCommunityRoom(client as never, roomId)).resolves.toMatchObject({
      currentMemberRole: 'manager',
      isOwner: false,
    })
    await expect(getCommunityMessages(client as never, roomId)).resolves.toEqual([
      expect.objectContaining({ senderRole: 'member' }),
    ])
  })

  it('발견 목록과 입장을 전용 RPC로 처리한다', async () => {
    const client = createClient({ data: [], error: null })
    client.rpc.mockResolvedValueOnce({ data: [], error: null }).mockResolvedValueOnce({
      data: [{ joined: true, member_id: '33333333-3333-4333-8333-333333333333', room_id: roomId }],
      error: null,
    })

    await getCommunityRooms(client as never)
    await joinCommunityRoom(client as never, roomId, '독자', '')

    expect(client.rpc).toHaveBeenNthCalledWith(1, 'list_community_rooms', { p_limit: 20 })
    expect(client.rpc).toHaveBeenNthCalledWith(2, 'join_community_room', {
      p_password: null,
      p_room_display_name: '독자',
      p_room_id: roomId,
    })
  })

  it('비밀번호 오픈 책방 생성은 RPC에만 원문을 전달한다', async () => {
    const client = createClient({
      data: [{ member_id: '33333333-3333-4333-8333-333333333333', room_id: roomId }],
      error: null,
    })

    await createCommunityRoom(client as never, '방장', {
      access: 'password',
      capacity: 8,
      description: '',
      name: '밤 독서회',
      password: 'safe-pass',
    })

    expect(client.rpc).toHaveBeenCalledWith('create_community_room', {
      p_access: 'password',
      p_capacity: 8,
      p_description: '',
      p_name: '밤 독서회',
      p_password: 'safe-pass',
      p_room_display_name: '방장',
    })
  })

  it('자유 채팅·제재·신고도 전용 RPC로만 요청한다', async () => {
    const client = createClient({ data: '44444444-4444-4444-8444-444444444444', error: null })
    client.rpc
      .mockResolvedValueOnce({ data: '44444444-4444-4444-8444-444444444444', error: null })
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: '55555555-5555-4555-8555-555555555555', error: null })

    await sendCommunityMessage(client as never, roomId, '함께 읽어요')
    await banCommunityMember(client as never, roomId, '33333333-3333-4333-8333-333333333333')
    await reportCommunityTarget(client as never, 'room', roomId, '운영자 확인이 필요해요')

    expect(client.rpc).toHaveBeenNthCalledWith(1, 'send_community_message', {
      p_body: '함께 읽어요',
      p_room_id: roomId,
    })
    expect(client.rpc).toHaveBeenNthCalledWith(2, 'ban_community_member', {
      p_room_id: roomId,
      p_target_member_id: '33333333-3333-4333-8333-333333333333',
    })
    expect(client.rpc).toHaveBeenNthCalledWith(3, 'create_content_report', {
      p_reason: '운영자 확인이 필요해요',
      p_target_id: roomId,
      p_target_type: 'room',
    })
  })

  it('운영자 신고 목록과 조치도 관리자 RPC로만 요청한다', async () => {
    const reportId = '55555555-5555-4555-8555-555555555555'
    const listResponse = {
      data: [
        {
          actions: [],
          created_at: '2026-08-18T12:00:00.000Z',
          id: reportId,
          reason: '확인이 필요해요',
          reporter_profile_id: '33333333-3333-4333-8333-333333333333',
          resolution_note: null,
          resolved_at: null,
          resolved_by: null,
          status: 'open',
          target_id: roomId,
          target_type: 'room',
        },
      ],
      error: null,
    }
    const client = createClient(listResponse)
    client.rpc.mockResolvedValueOnce(listResponse).mockResolvedValueOnce({
      data: [
        {
          created_at: '2026-08-18T12:00:00.000Z',
          id: reportId,
          reason: '확인이 필요해요',
          reporter_profile_id: '33333333-3333-4333-8333-333333333333',
          resolution_note: '검토 완료',
          resolved_at: '2026-08-18T13:00:00.000Z',
          resolved_by: '44444444-4444-4444-8444-444444444444',
          status: 'resolved',
          target_id: roomId,
          target_type: 'room',
        },
      ],
      error: null,
    })

    await listAdminContentReports(client as never, 'open')
    await updateAdminContentReport(client as never, reportId, 'resolved', '검토 완료')

    expect(client.rpc).toHaveBeenNthCalledWith(1, 'list_content_reports', { p_status: 'open' })
    expect(client.rpc).toHaveBeenNthCalledWith(2, 'update_content_report', {
      p_report_id: reportId,
      p_resolution_note: '검토 완료',
      p_status: 'resolved',
    })
  })
})
