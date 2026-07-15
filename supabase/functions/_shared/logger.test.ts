import { assertEquals } from 'jsr:@std/assert@1.0.14'
import { createLogRecord } from './logger.ts'

Deno.test('createLogRecord keeps operational allowlist fields only', () => {
  const record = createLogRecord('error', 'mux_webhook_failed', {
    requestId: 'request-1',
    eventId: 'event-1',
    status: 'failed',
    body: 'private user text',
    token: 'secret-token',
    uploadUrl: 'https://private.example/upload',
    nested: { email: 'user@example.com' },
  }, '2026-07-16T00:00:00.000Z')

  assertEquals(record, {
    timestamp: '2026-07-16T00:00:00.000Z',
    level: 'error',
    event: 'mux_webhook_failed',
    requestId: 'request-1',
    eventId: 'event-1',
    status: 'failed',
  })
})
