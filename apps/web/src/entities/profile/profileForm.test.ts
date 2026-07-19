import { describe, expect, it } from 'vitest'

import { normalizeProfileForm, profileFormSchema, profileUpdateSchema } from './profileForm'

describe('profileFormSchema', () => {
  it('normalizes optional profile fields before they cross the repository boundary', () => {
    const form = profileFormSchema.parse({
      displayName: '  민규  ',
      bio: '   ',
      mbti: 'INTP',
    })

    expect(normalizeProfileForm(form)).toEqual({
      displayName: '민규',
      bio: undefined,
      mbti: 'INTP',
    })
  })

  it('rejects a blank display name', () => {
    expect(() => profileFormSchema.parse({ displayName: '   ', mbti: null })).toThrow()
  })

  it('rejects an avatar path outside the private profile directory format', () => {
    expect(() =>
      profileUpdateSchema.parse({
        avatarPath: 'https://example.com/profile.png',
        bio: '소개',
        displayName: '민규',
        mbti: null,
      }),
    ).toThrow()
  })
})
