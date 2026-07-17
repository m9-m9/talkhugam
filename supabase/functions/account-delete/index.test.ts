import { assertEquals } from 'jsr:@std/assert@1.0.14'
import { createAccountDeletionSuccessResponse } from './index.ts'

Deno.test('완료 기록 보류도 표준 성공 envelope로 응답한다', async () => {
  const response = createAccountDeletionSuccessResponse(
    { completionPending: true, deleted: true },
    'deletion-request-id',
    'http-request-id',
  )

  assertEquals(response.status, 200)
  assertEquals(await response.json(), {
    data: {
      completionPending: true,
      deleted: true,
      requestId: 'deletion-request-id',
    },
    ok: true,
    requestId: 'http-request-id',
  })
})
