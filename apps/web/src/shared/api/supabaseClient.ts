import { createClient } from '@supabase/supabase-js'

import { getClientEnv } from '../../app/env'

let supabaseClient: ReturnType<typeof createClient> | undefined

/** Supabase 클라이언트 데이터를 생성해 반환한다. */
export function createSupabaseClient() {
  if (supabaseClient) return supabaseClient

  const env = getClientEnv()
  supabaseClient = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY)

  return supabaseClient
}
