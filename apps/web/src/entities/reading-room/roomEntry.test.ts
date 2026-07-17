import { describe, expect, it } from 'vitest'

import { createRoomFormSchema, joinRoomFormSchema } from './roomEntry'

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

  it('requires exactly six characters', () => {
    expect(() => joinRoomFormSchema.parse({ code: 'talk2' })).toThrow()
  })
})
