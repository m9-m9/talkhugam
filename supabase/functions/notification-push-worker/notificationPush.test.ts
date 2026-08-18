import { assertEquals } from 'jsr:@std/assert@1.0.14'
import { classifyExpoPushResponse, createNotificationPushTarget, isDeviceNotRegistered, parseNotificationPushJobs } from './notificationPush.ts'

const job = parseNotificationPushJobs([{
  attempts: 1, book_chat_id: crypto.randomUUID(), id: crypto.randomUUID(),
  notification_id: crypto.randomUUID(), recipient_profile_id: crypto.randomUUID(),
  room_id: crypto.randomUUID(), type: 'reply',
}])[0]!

Deno.test('푸시 작업은 UUID 기반 앱 내부 책 대화 경로만 만든다', () => {
  assertEquals(createNotificationPushTarget(job), '/rooms/' + job.room_id + '/books/' + job.book_chat_id)
})

Deno.test('Expo 실패는 일시 오류만 재시도하고 나머지는 무효 처리한다', () => {
  assertEquals(classifyExpoPushResponse(new Response('', { status: 503 })), 'retry')
  assertEquals(classifyExpoPushResponse(new Response('', { status: 400 })), 'invalid')
})

Deno.test('등록 해제 Expo ticket만 기기 토큰 해제 대상으로 식별한다', () => {
  assertEquals(isDeviceNotRegistered({ data: [{ details: { error: 'DeviceNotRegistered' } }] }), true)
  assertEquals(isDeviceNotRegistered({ data: [{ details: { error: 'InvalidCredentials' } }] }), false)
})
