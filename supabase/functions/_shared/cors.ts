import { readOptionalEnv } from './env.ts'

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]

/** 외부 입력을 검증해 허용된 Origins 형식으로 변환한다. */
export function parseAllowedOrigins(rawOrigins: string | undefined): ReadonlySet<string> {
  const origins = rawOrigins
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  return new Set(origins?.length ? origins : DEFAULT_ALLOWED_ORIGINS)
}

/** 요청 origin을 검증해 CORS 응답 header를 만든다. */
export function createCorsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('origin')
  const allowedOrigins = parseAllowedOrigins(readOptionalEnv('ALLOWED_ORIGINS'))
  const allowedOrigin = origin && allowedOrigins.has(origin) ? origin : 'null'

  return {
    'access-control-allow-origin': allowedOrigin,
    'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info, x-request-id',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-max-age': '86400',
    vary: 'Origin',
  }
}

/** 허용된 origin을 반영한 CORS preflight 응답을 만든다. */
export function optionsResponse(request: Request): Response | null {
  if (request.method !== 'OPTIONS') return null

  return new Response(null, {
    status: 204,
    headers: createCorsHeaders(request),
  })
}
