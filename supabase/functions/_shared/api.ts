export const API_ERROR_CODES = [
  'AUTH_REQUIRED',
  'AUTH_PROVIDER_FAILED',
  'PROFILE_REQUIRED',
  'ROOM_NOT_FOUND',
  'ROOM_FORBIDDEN',
  'ROOM_FULL',
  'ROOM_ARCHIVED',
  'INVITE_INVALID',
  'INVITE_EXPIRED',
  'INVITE_REVOKED',
  'MEMBER_ALREADY_JOINED',
  'OWNER_TRANSFER_REQUIRED',
  'BOOK_NOT_FOUND',
  'BOOK_SEARCH_FAILED',
  'BOOK_CHAT_NOT_FOUND',
  'BOOK_CHAT_ARCHIVED',
  'POST_NOT_FOUND',
  'POST_REPLY_DEPTH_EXCEEDED',
  'POST_CROSS_THREAD_REPLY',
  'MENTION_MEMBER_INVALID',
  'VIDEO_TOO_LONG',
  'VIDEO_UPLOAD_FAILED',
  'VIDEO_PROCESSING_FAILED',
  'RATE_LIMITED',
  'CONFLICT',
  'VALIDATION_FAILED',
  'INTERNAL_ERROR',
] as const

export type ApiErrorCode = (typeof API_ERROR_CODES)[number]

export type ApiSuccess<T> = {
  ok: true
  data: T
  requestId: string
}

export type ApiFailure = {
  ok: false
  error: {
    code: ApiErrorCode
    message: string
    field?: string
    retryable: boolean
  }
  requestId: string
}

type FailureInput = {
  code: ApiErrorCode
  message: string
  retryable?: boolean
  field?: string
}

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
} as const

/** 요청 ID 데이터를 생성해 반환한다. */
export function createRequestId(request: Request): string {
  return request.headers.get('x-request-id') ?? crypto.randomUUID()
}

/** 데이터와 요청 ID를 포함한 표준 성공 응답을 만든다. */
export function successResponse<T>(
  data: T,
  requestId: string,
  headers: HeadersInit = {},
  status = 200,
): Response {
  const body: ApiSuccess<T> = { ok: true, data, requestId }

  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...headers },
  })
}

/** 오류 코드와 요청 ID를 포함한 표준 실패 응답을 만든다. */
export function failureResponse(
  input: FailureInput,
  requestId: string,
  status: number,
  headers: HeadersInit = {},
): Response {
  const error = input.field
    ? { code: input.code, message: input.message, field: input.field, retryable: input.retryable ?? false }
    : { code: input.code, message: input.message, retryable: input.retryable ?? false }
  const body: ApiFailure = { ok: false, error, requestId }

  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...headers },
  })
}
