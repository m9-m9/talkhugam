export function readOptionalEnv(name: string): string | undefined {
  const value = Deno.env.get(name)?.trim()
  return value || undefined
}

export function readRequiredEnv(name: string): string {
  const value = readOptionalEnv(name)
  if (!value) throw new Error(`Missing required environment variable: ${name}`)

  return value
}
