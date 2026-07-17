import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2.110.5'
import { readOptionalEnv, readRequiredEnv } from './env.ts'

export type AuthenticatedContext = {
  client: SupabaseClient
  user: User
}

/** Bearer 토큰 데이터를 조회하거나 계산해 반환한다. */
function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) return null

  return authorization.slice('Bearer '.length).trim() || null
}

/** 관리자 클라이언트 데이터를 생성해 반환한다. */
export function createAdminClient(): SupabaseClient {
  const secretKey = readOptionalEnv('SUPABASE_SECRET_KEY')
    ?? readRequiredEnv('SUPABASE_SERVICE_ROLE_KEY')

  return createClient(
    readRequiredEnv('SUPABASE_URL'),
    secretKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

/** 사용자 클라이언트 데이터를 생성해 반환한다. */
export function createUserClient(request: Request): SupabaseClient {
  const publishableKey = readOptionalEnv('SUPABASE_PUBLISHABLE_KEY')
    ?? readRequiredEnv('SUPABASE_ANON_KEY')

  return createClient(
    readRequiredEnv('SUPABASE_URL'),
    publishableKey,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: request.headers.get('authorization') ?? '' } },
    },
  )
}

/** 요청 토큰을 검증해 인증 사용자와 Supabase client를 반환한다. */
export async function getAuthenticatedContext(request: Request): Promise<AuthenticatedContext | null> {
  const accessToken = getBearerToken(request)
  if (!accessToken) return null

  const client = createUserClient(request)
  const { data, error } = await client.auth.getUser(accessToken)
  if (error || !data.user) return null

  return { client, user: data.user }
}
