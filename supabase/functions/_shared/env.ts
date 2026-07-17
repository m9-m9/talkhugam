/** Optional 환경변수 값을 읽고 검증해 반환한다. */
export function readOptionalEnv(name: string): string | undefined {
  const value = Deno.env.get(name)?.trim()
  return value || undefined
}

/** 필수 환경변수 값을 읽고 검증해 반환한다. */
export function readRequiredEnv(name: string): string {
  const value = readOptionalEnv(name)
  if (!value) throw new Error(`Missing required environment variable: ${name}`)

  return value
}
