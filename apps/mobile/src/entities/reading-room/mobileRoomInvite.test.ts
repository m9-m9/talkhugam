import { describe, expect, it, vi } from 'vitest'

import {
  createMobileInviteShareMessage,
  createMobileRoomInvite,
  getMobileMyRoomRole,
  requestMobileRoomInvite,
} from './mobileRoomInvite'

const roomId = '00000000-0000-4000-8000-000000000001'

describe('mobileRoomInvite', () => {
  it('reads the current member role through the role RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 'manager', error: null })

    await expect(getMobileMyRoomRole({ rpc } as never, roomId)).resolves.toBe('manager')
    expect(rpc).toHaveBeenCalledWith('get_my_room_role', { p_room_id: roomId })
  })

  it('creates a one-time invite for a manager', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ code: 'TALK87', expires_at: '2026-08-19T00:00:00.000Z', invite_id: roomId, token: 'a'.repeat(64) }],
      error: null,
    })

    await expect(createMobileRoomInvite({ rpc } as never, roomId)).resolves.toEqual({
      code: 'TALK87',
      expiresAt: '2026-08-19T00:00:00.000Z',
      token: 'a'.repeat(64),
    })
    expect(rpc).toHaveBeenCalledWith('create_room_invite', { p_room_id: roomId })
  })

  it('asks the room managers for an invite and returns whether it was new', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null })

    await expect(requestMobileRoomInvite({ rpc } as never, roomId)).resolves.toBe(false)
    expect(rpc).toHaveBeenCalledWith('request_room_invite', { p_room_id: roomId })
  })

  it('builds the same invite message and join link as the web share sheet', () => {
    expect(createMobileInviteShareMessage({ code: 'TALK87', token: 'b'.repeat(64) })).toBe(
      `책방에 초대해요.\n초대 코드: TALK87\nTalk후감에서 코드를 입력해 함께 읽기 시작해요.\nhttps://talkhugam.vercel.app/rooms/join?invite=${'b'.repeat(64)}`,
    )
  })
})
