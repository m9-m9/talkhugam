import { describe, expect, it } from 'vitest'

import { normalizeProfileForm, profileFormSchema } from './profileForm'

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
})
