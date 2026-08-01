import { describe, expect, it, vi } from 'vitest'

import { createRoomFormSchema, createRoomWithInvite, joinRoomFormSchema } from './roomEntry'

const { getProfile } = vi.hoisted(() => ({ getProfile: vi.fn() }))

vi.mock('../profile', () => ({ getProfile }))

describe('createRoomFormSchema', () => {
  it('trims valid room input', () => {
    expect(
      createRoomFormSchema.parse({
        description: ' 함께 읽는 책이에요 ',
        name: ' 금요일 아침 독서방 ',
      }),
    ).toEqual({
      description: '함께 읽는 책이에요',
      name: '금요일 아침 독서방',
    })
  })
})

describe('joinRoomFormSchema', () => {
  it('normalizes invite codes to uppercase', () => {
    expect(joinRoomFormSchema.parse({ code: 'talk26' })).toEqual({ code: 'TALK26' })
  })

  it('keeps a 64-character invite link token unchanged', () => {
    const token = 'a'.repeat(64)

    expect(joinRoomFormSchema.parse({ code: token })).toEqual({ code: token })
  })

  it('requires exactly six characters', () => {
    expect(() => joinRoomFormSchema.parse({ code: 'talk2' })).toThrow()
  })
})

describe('createRoomWithInvite', () => {
  it('returns the one-time token with the generated invite code', async () => {
    const inviteToken = 'a'.repeat(64)
    const client = {
      rpc: vi
        .fn()
        .mockResolvedValueOnce({
          data: [{ room_id: '00000000-0000-4000-8000-000000000101' }],
          error: null,
        })
        .mockResolvedValueOnce({
          data: [
            {
              code: 'TALK87',
              expires_at: '2026-08-02T00:00:00+00:00',
              token: inviteToken,
            },
          ],
          error: null,
        }),
    }
    getProfile.mockResolvedValue({ displayName: '정민규' })

    await expect(
      createRoomWithInvite(client as never, '00000000-0000-0000-0000-000000000001', {
        description: '',
        name: '금요일 아침 책방',
      }),
    ).resolves.toEqual({
      code: 'TALK87',
      expiresAt: '2026-08-02T00:00:00+00:00',
      roomId: '00000000-0000-4000-8000-000000000101',
      token: inviteToken,
    })
  })
})
