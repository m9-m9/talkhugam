import { assertEquals, assertThrows } from 'jsr:@std/assert@1.0.14'

import { adminFeedbackRequestSchema } from './schema.ts'

Deno.test('admin feedback schema accepts a status change request', () => {
  assertEquals(
    adminFeedbackRequestSchema.parse({
      action: 'update_status',
      status: 'completed',
      ticketId: '123e4567-e89b-42d3-a456-426614174000',
    }),
    {
      action: 'update_status',
      status: 'completed',
      ticketId: '123e4567-e89b-42d3-a456-426614174000',
    },
  )
})

Deno.test('admin feedback schema rejects a non-operator action', () => {
  assertThrows(() => adminFeedbackRequestSchema.parse({ action: 'delete' }))
})
