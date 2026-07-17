import { createClient } from '@supabase/supabase-js'

import { getClientEnv } from '../../app/env'

let supabaseClient: ReturnType<typeof createClient> | undefined

export function createSupabaseClient() {
  if (supabaseClient) return supabaseClient

  const env = getClientEnv()
  supabaseClient = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY)

  return supabaseClient
}
