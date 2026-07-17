import type { ZodType } from 'npm:zod@4.4.3'

export type ParsedBody<T> =
  | { ok: true; value: T }
  | { ok: false; field?: string }

/** 외부 입력을 검증해 JSON Body 형식으로 변환한다. */
export async function parseJsonBody<T>(request: Request, schema: ZodType<T>): Promise<ParsedBody<T>> {
  const value: unknown = await request.json().catch(() => null)
  const result = schema.safeParse(value)
  if (result.success) return { ok: true, value: result.data }

  const field = result.error.issues[0]?.path.join('.') || undefined
  return field ? { ok: false, field } : { ok: false }
}
