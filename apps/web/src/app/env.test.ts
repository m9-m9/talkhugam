import { describe, expect, it } from 'vitest'

import { parseClientEnv } from './env'

describe('parseClientEnv', () => {
  it('accepts the browser-safe Supabase configuration', () => {
    expect(
      parseClientEnv({
        VITE_SUPABASE_URL: 'https://talkhugam.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
      }),
    ).toEqual({
      VITE_SUPABASE_URL: 'https://talkhugam.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
    })
  })

  it('rejects an incomplete configuration', () => {
    expect(() => parseClientEnv({ VITE_SUPABASE_URL: 'not-a-url' })).toThrow()
  })
})
