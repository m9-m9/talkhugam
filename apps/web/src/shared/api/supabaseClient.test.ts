import { describe, expect, it, vi } from 'vitest'

import { createSupabaseClient } from './supabaseClient'

const { createClient } = vi.hoisted(() => ({
  createClient: vi.fn(() => ({ clientId: crypto.randomUUID() })),
}))

vi.mock('@supabase/supabase-js', () => ({ createClient }))
vi.mock('../../app/env', () => ({
  getClientEnv: () => ({
    VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
    VITE_SUPABASE_URL: 'https://example.supabase.co',
  }),
}))

describe('createSupabaseClient', () => {
  it('reuses one browser client for every repository call', () => {
    const firstClient = createSupabaseClient()
    const secondClient = createSupabaseClient()

    expect(secondClient).toBe(firstClient)
    expect(createClient).toHaveBeenCalledOnce()
  })
})
