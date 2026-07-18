import { assertEquals } from 'jsr:@std/assert@1.0.14'

import { handleAdminFeedback } from './admin-feedback/index.ts'
import { handleFeedbackSubmit } from './feedback-submit/index.ts'
import { createJsonRequest } from './_test/request.ts'

Deno.test('feedback submission requires an authenticated user', async () => {
  const request = createJsonRequest('feedback-submit', {
    body: '의견입니다.',
    category: 'other',
  })

  assertEquals((await handleFeedbackSubmit(request)).status, 401)
})

Deno.test('operator inbox requires an authenticated user', async () => {
  const request = createJsonRequest('admin-feedback', { action: 'access' })

  assertEquals((await handleAdminFeedback(request)).status, 401)
})
