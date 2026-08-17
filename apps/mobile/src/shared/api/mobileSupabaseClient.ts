import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'

import { parseMobilePublicEnv } from '@talkhugam/domain'

let mobileSupabaseClient: SupabaseClient | null = null

/** Expo SecureStore를 Supabase 세션 저장소가 요구하는 비동기 인터페이스로 반환한다. */
function createSecureStoreAdapter(): {
  getItem(key: string): Promise<string | null>
  removeItem(key: string): Promise<void>
  setItem(key: string, value: string): Promise<void>
} {
  return {
    getItem: (key) => SecureStore.getItemAsync(key),
    removeItem: (key) => SecureStore.deleteItemAsync(key),
    setItem: (key, value) => SecureStore.setItemAsync(key, value),
  }
}

/** 공개 환경값과 기기 보안 저장소를 사용해 앱 전체의 Supabase 클라이언트를 반환한다. */
export function createMobileSupabaseClient(): SupabaseClient {
  if (mobileSupabaseClient) return mobileSupabaseClient

  const env = parseMobilePublicEnv(process.env)
  mobileSupabaseClient = createClient(
    env.EXPO_PUBLIC_SUPABASE_URL,
    env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
        persistSession: true,
        storage: createSecureStoreAdapter(),
      },
    },
  )

  return mobileSupabaseClient
}
