export type LogLevel = 'info' | 'warn' | 'error'

export type OperationalEvent =
  | 'account_delete_failed'
  | 'account_delete_succeeded'
  | 'book_search_failed'
  | 'deletion_worker_completed'
  | 'mux_playback_token_failed'
  | 'mux_upload_failed'
  | 'mux_upload_started'
  | 'mux_webhook_failed'
  | 'kakao_oauth_failed'
  | 'kakao_oauth_succeeded'
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
])

function sanitizeMetadata(metadata: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(metadata).filter(([key, value]) =>
      ALLOWED_METADATA_KEYS.has(key)
      && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    ),
  )
}

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
