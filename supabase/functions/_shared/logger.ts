export type LogLevel = 'info' | 'warn' | 'error'

export type OperationalEvent =
  | 'account_delete_completion_pending'
  | 'account_delete_failed'
  | 'account_delete_succeeded'
  | 'book_search_failed'
  | 'bestseller_refresh_completed'
  | 'bestseller_refresh_failed'
  | 'deletion_worker_completed'
  | 'mux_playback_token_failed'
  | 'mux_thumbnail_tokens_failed'
  | 'mux_upload_failed'
  | 'mux_upload_started'
  | 'mux_webhook_failed'
  | 'naver_oauth_failed'
  | 'naver_oauth_succeeded'

const ALLOWED_METADATA_KEYS = new Set([
  'requestId',
  'eventId',
  'jobCount',
  'completedCount',
  'retriedCount',
  'status',
  'code',
  'retryable',
  'durationMs',
  'count',
])

/** 운영 로그 metadata에서 허용된 필드만 남긴다. */
function sanitizeMetadata(metadata: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(metadata).filter(([key, value]) =>
      ALLOWED_METADATA_KEYS.has(key)
      && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    ),
  )
}

/** 운영 로그 level과 message를 구조화된 기록으로 만든다. */
export function createLogRecord(
  level: LogLevel,
  event: OperationalEvent,
  metadata: Readonly<Record<string, unknown>> = {},
  timestamp = new Date().toISOString(),
): Record<string, unknown> {
  return {
    timestamp,
    level,
    event,
    ...sanitizeMetadata(metadata),
  }
}

/** Operational 이벤트 운영 정보를 민감값 없이 기록한다. */
export function logOperationalEvent(
  level: LogLevel,
  event: OperationalEvent,
  metadata: Readonly<Record<string, unknown>> = {},
): void {
  const serialized = JSON.stringify(createLogRecord(level, event, metadata))
  if (level === 'error') console.error(serialized)
  else if (level === 'warn') console.warn(serialized)
  else console.info(serialized)
}
