import { createClient } from '@supabase/supabase-js'

import { getClientEnv } from '../../app/env'

export function createSupabaseClient() {
  const env = getClientEnv()

  return createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY)
}
