import { z } from 'zod'

const clientEnvSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
})

export type ClientEnv = z.infer<typeof clientEnvSchema>

export function parseClientEnv(input: unknown): ClientEnv {
  return clientEnvSchema.parse(input)
}

export function getClientEnv(): ClientEnv {
  return parseClientEnv(import.meta.env)
}
