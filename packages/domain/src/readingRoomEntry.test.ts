import { describe, expect, it } from 'vitest'

import { createRoomFormSchema, joinRoomFormSchema, parseInviteToken } from './readingRoomEntry'

describe('private reading-room entry domain', () => {
  it('trims room creation values with the existing constraints', () => {
    expect(
      createRoomFormSchema.parse({
        description: ' 함께 읽는 책이에요 ',
        name: ' 금요일 아침 독서방 ',
      }),
    ).toEqual({ description: '함께 읽는 책이에요', name: '금요일 아침 독서방' })
  })

  it('normalizes six-character invite codes without changing invite tokens', () => {
    expect(joinRoomFormSchema.parse({ code: 'talk26' })).toEqual({ code: 'TALK26' })

    const token = 'a'.repeat(64)
    expect(joinRoomFormSchema.parse({ code: token })).toEqual({ code: token })
  })

  it('accepts only server-shaped invite tokens from a URL', () => {
    expect(parseInviteToken('a'.repeat(64))).toBe('a'.repeat(64))
    expect(parseInviteToken('TALK26')).toBeNull()
  })
})
