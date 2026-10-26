import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

const tokenSchema = z.string().regex(/^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]$/)

/** 검증한 Expo 토큰과 플랫폼을 현재 인증 회원 전용 RPC에 등록한다. */
export async function registerMobilePushToken(client: SupabaseClient, token: unknown, platform: unknown): Promise<void> {
  const response = await client.rpc('register_device_token', {
    p_expo_push_token: tokenSchema.parse(token),
    p_platform: z.enum(['ios', 'android']).parse(platform),
  })
  if (response.error) throw response.error
}

/** 현재 인증 회원이 소유한 검증된 Expo 토큰만 해제하도록 요청한다. */
export async function revokeMobilePushToken(client: SupabaseClient, token: unknown): Promise<void> {
  const response = await client.rpc('revoke_device_token', { p_expo_push_token: tokenSchema.parse(token) })
  if (response.error) throw response.error
}
