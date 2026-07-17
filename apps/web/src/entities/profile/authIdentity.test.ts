import { describe, expect, it } from 'vitest'

import { getProviderLabels } from './authIdentity'

describe('getProviderLabels', () => {
  it('shows Korean labels for supported social login providers', () => {
    expect(getProviderLabels({ provider: 'kakao', providers: ['kakao'] })).toEqual(['카카오'])
  })

  it('uses the singular provider for older auth metadata', () => {
    expect(getProviderLabels({ provider: 'google' })).toEqual(['Google'])
  })
})
