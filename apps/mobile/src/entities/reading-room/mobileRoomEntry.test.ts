import { describe, expect, it, vi } from 'vitest'

import { createMobileRoomWithInvite, joinMobileRoomByCode } from './mobileRoomEntry'

const roomId = '00000000-0000-4000-8000-000000000001'
const profile = {
  avatarPath: null,
  bio: null,
  displayName: '민규',
  onboardingCompletedAt: '2026-08-18T00:00:00.000Z',
  updatedAt: '2026-08-18T00:00:00.000Z',
}

vi.mock('../profile', () => ({ getMobileProfile: vi.fn() }))

import { getMobileProfile } from '../profile'

const mockGetMobileProfile = vi.mocked(getMobileProfile)

describe('createMobileRoomWithInvite', () => {
  it('validates the form and creates a room plus its one-time invite through RPCs only', async () => {
    mockGetMobileProfile.mockResolvedValue(profile)
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ room_id: roomId }], error: null })
      .mockResolvedValueOnce({
        data: [
          {
            code: 'TALK87',
            expires_at: '2026-08-19T00:00:00.000Z',
            token: 'a'.repeat(64),
          },
        ],
        error: null,
      })
    const client = { rpc }

    await expect(
      createMobileRoomWithInvite(client as never, {
        description: ' 이번 달 함께 읽는 책들 ',
        name: ' 금요일 아침 책방 ',
      }),
    ).resolves.toEqual({
      code: 'TALK87',
      expiresAt: '2026-08-19T00:00:00.000Z',
      roomId,
      token: 'a'.repeat(64),
    })
    expect(rpc).toHaveBeenNthCalledWith(1, 'create_reading_room', {
      p_description: '이번 달 함께 읽는 책들',
      p_name: '금요일 아침 책방',
      p_room_display_name: '민규',
    })
    expect(rpc).toHaveBeenNthCalledWith(2, 'create_room_invite', { p_room_id: roomId })
  })

  it('rejects a blank name before sending a create RPC', async () => {
    const rpc = vi.fn()

    await expect(
      createMobileRoomWithInvite({ rpc } as never, { description: '', name: '  ' }),
    ).rejects.toThrow('책방 이름을 입력해 주세요.')
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe('joinMobileRoomByCode', () => {
  it('normalizes an invite code then joins through the protected RPC', async () => {
    mockGetMobileProfile.mockResolvedValue(profile)
    const rpc = vi.fn().mockResolvedValue({ data: [{ room_id: roomId }], error: null })

    await expect(joinMobileRoomByCode({ rpc } as never, { code: 'talk87' })).resolves.toBe(roomId)
    expect(rpc).toHaveBeenCalledWith('join_room_by_invite', {
      p_code_or_token: 'TALK87',
      p_room_display_name: '민규',
    })
  })
})
