import type { ZodType } from 'npm:zod@4.4.3'

export type ParsedBody<T> =
  | { ok: true; value: T }
  | { ok: false; field?: string }

export async function parseJsonBody<T>(request: Request, schema: ZodType<T>): Promise<ParsedBody<T>> {
  const value: unknown = await request.json().catch(() => null)
  const result = schema.safeParse(value)
  if (result.success) return { ok: true, value: result.data }

  const field = result.error.issues[0]?.path.join('.') || undefined
  return field ? { ok: false, field } : { ok: false }
}
