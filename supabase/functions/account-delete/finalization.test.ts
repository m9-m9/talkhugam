import { assertEquals } from 'jsr:@std/assert@1.0.14'
import { executeAccountDeletion, retryAccountDeletionFinalization } from './finalization.ts'

Deno.test('계정 삭제 완료 기록은 일시 실패 뒤 재시도에서 성공한다', async () => {
  let attempts = 0

  const result = await retryAccountDeletionFinalization(async () => {
    attempts += 1
    return attempts === 2
  })

  assertEquals(result, { attempts: 2, isCompleted: true })
})

Deno.test('계정 삭제 완료 기록이 모두 실패해도 제한된 횟수만 시도한다', async () => {
  let attempts = 0

  const result = await retryAccountDeletionFinalization(async () => {
    attempts += 1
    throw new Error('finish unavailable')
  })

  assertEquals(result, { attempts: 3, isCompleted: false })
})

Deno.test('Auth 삭제 성공 뒤 완료 기록이 모두 실패해도 삭제 성공과 보류 상태를 반환한다', async () => {
  const result = await executeAccountDeletion(
    async () => true,
    async () => false,
  )

  assertEquals(result, { completionPending: true, deleted: true })
})
