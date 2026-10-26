import { describe, expect, it } from 'vitest'

import { createMobileAuthRedirectUri, parseMobilePublicEnv } from './mobileAuth'

describe('mobile authentication foundation', () => {
  it('creates the registered Talk후감 OAuth callback URI', () => {
    expect(createMobileAuthRedirectUri()).toBe('talkhugam://auth/callback')
  })

  it('rejects an invalid Supabase endpoint before it reaches the mobile client', () => {
    expect(() =>
      parseMobilePublicEnv({
        EXPO_PUBLIC_SUPABASE_URL: 'not-a-url',
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
      }),
    ).toThrow()
  })
})
