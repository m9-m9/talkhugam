import { assertEquals } from 'jsr:@std/assert@1.0.14'
import { failureResponse, successResponse } from './api.ts'

Deno.test('successResponse wraps data with request id', async () => {
  const response = successResponse({ roomId: 'room-id' }, 'request-id')

  assertEquals(response.status, 200)
  assertEquals(await response.json(), {
    ok: true,
    data: { roomId: 'room-id' },
    requestId: 'request-id',
  })
})

Deno.test('failureResponse omits an absent field', async () => {
  const response = failureResponse(
    { code: 'AUTH_REQUIRED', message: '로그인이 필요합니다.' },
    'request-id',
    401,
  )

  assertEquals(response.status, 401)
  assertEquals(await response.json(), {
    ok: false,
    error: {
      code: 'AUTH_REQUIRED',
      message: '로그인이 필요합니다.',
      retryable: false,
    },
    requestId: 'request-id',
  })
})
