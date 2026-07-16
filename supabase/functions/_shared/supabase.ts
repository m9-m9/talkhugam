import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { readRequiredEnv } from './env.ts'

export type AuthenticatedContext = {
  client: SupabaseClient
  user: User
}

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) return null

  return authorization.slice('Bearer '.length).trim() || null
}

export function createAdminClient(): SupabaseClient {
  return createClient(
    readRequiredEnv('SUPABASE_URL'),
    readRequiredEnv('SUPABASE_SECRET_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export function createUserClient(request: Request): SupabaseClient {
  return createClient(
    readRequiredEnv('SUPABASE_URL'),
    readRequiredEnv('SUPABASE_PUBLISHABLE_KEY'),
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: request.headers.get('authorization') ?? '' } },
    },
  )
}

export async function getAuthenticatedContext(request: Request): Promise<AuthenticatedContext | null> {
  const accessToken = getBearerToken(request)
  if (!accessToken) return null

  const client = createUserClient(request)
  const { data, error } = await client.auth.getUser(accessToken)
  if (error || !data.user) return null

  return { client, user: data.user }
}
