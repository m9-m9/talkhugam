import { z } from 'zod'

const clientEnvSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
})

export type ClientEnv = z.infer<typeof clientEnvSchema>

/** 외부 입력을 검증해 클라이언트 환경변수 형식으로 변환한다. */
export function parseClientEnv(input: unknown): ClientEnv {
  return clientEnvSchema.parse(input)
}

/** 클라이언트 환경변수 데이터를 조회하거나 계산해 반환한다. */
export function getClientEnv(): ClientEnv {
  return parseClientEnv(import.meta.env)
}
