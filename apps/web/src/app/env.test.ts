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

  it('accepts the public Clarity project tag', () => {
    expect(
      parseClientEnv({
        VITE_CLARITY_PROJECT_ID: 'xoernfdaoq',
        VITE_SUPABASE_URL: 'https://talkhugam.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
      }),
    ).toMatchObject({ VITE_CLARITY_PROJECT_ID: 'xoernfdaoq' })
  })

  it('rejects an incomplete configuration', () => {
    expect(() => parseClientEnv({ VITE_SUPABASE_URL: 'not-a-url' })).toThrow()
  })
})
