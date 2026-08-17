import { z } from 'zod'

const mobilePublicEnvSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.string().url(),
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
})

export type MobilePublicEnv = z.infer<typeof mobilePublicEnvSchema>

/** 모바일 앱의 공개 환경값을 검증해 Supabase 연결 설정으로 반환한다. */
export function parseMobilePublicEnv(input: unknown): MobilePublicEnv {
  return mobilePublicEnvSchema.parse(input)
}

/** 등록된 앱 scheme을 사용해 OAuth 로그인 뒤 복귀할 URI를 반환한다. */
export function createMobileAuthRedirectUri(): string {
  return 'talkhugam://auth/callback'
}
