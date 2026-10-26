import { describe, expect, it } from 'vitest'

import { normalizeProfileForm, profileFormSchema } from './profileForm'

describe('profileFormSchema', () => {
  it('trims a valid profile before it reaches a repository boundary', () => {
    const profile = profileFormSchema.parse({
      bio: '  천천히 읽고 오래 이야기해요.  ',
      displayName: '  민규  ',
    })

    expect(normalizeProfileForm(profile)).toEqual({
      bio: '천천히 읽고 오래 이야기해요.',
      displayName: '민규',
    })
  })

  it('rejects a profile without a readable display name', () => {
    expect(() => profileFormSchema.parse({ bio: '', displayName: '   ' })).toThrow(
      '이름을 입력해 주세요.',
    )
  })
})
