import { z } from 'npm:zod@4.4.3'
import { readRequiredEnv } from '../_shared/env.ts'
import { logOperationalEvent } from '../_shared/logger.ts'
import { secureEqual } from '../_shared/secret.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { classifyExpoPushResponse, createNotificationPushTarget, isDeviceNotRegistered, parseNotificationPushJobs } from './notificationPush.ts'

const tokenSchema = z.array(z.object({ expo_push_token: z.string().min(20) }))

/** 실패 횟수에 맞는 다음 worker 실행 시각을 계산한다. */
function retryAt(attempts: number): string {
  return new Date(Date.now() + Math.min(3600, 30 * 2 ** Math.max(0, attempts - 1)) * 1000).toISOString()
}

/** Expo Push Service로 토큰 묶음에 안전한 제목과 내부 경로만 전달한다. */
async function sendExpoPush(
  tokens: readonly string[],
  targetPath: string | null,
): Promise<{ result: 'sent' | 'retry' | 'invalid'; deviceNotRegistered: boolean }> {
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(tokens.map((to) => ({
      to, sound: 'default', title: 'Talk후감', body: '새 책방 소식이 도착했어요.',
      data: { targetPath },
    }))),
  })
  const result = classifyExpoPushResponse(response)
  if (result !== 'invalid') return { result, deviceNotRegistered: false }
  return { result, deviceNotRegistered: isDeviceNotRegistered(await response.json().catch(() => null)) }
}

/** worker 공유 비밀을 확인하고 outbox 푸시 작업을 처리한다. */
export async function handleNotificationPushWorker(request: Request): Promise<Response> {
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  if (!secureEqual(request.headers.get('authorization') ?? '', 'Bearer ' + readRequiredEnv('NOTIFICATION_PUSH_WORKER_SECRET'))) {
    return new Response('Unauthorized', { status: 401 })
  }
  const admin = createAdminClient()
  const claimed = await admin.rpc('claim_notification_push_jobs', { p_limit: 20 })
  if (claimed.error) return new Response('Claim failed', { status: 500 })
  const jobs = parseNotificationPushJobs(claimed.data)
  let sent = 0
  let retried = 0
  let revoked = 0
  for (const job of jobs) {
    const tokensResponse = await admin.from('device_tokens').select('expo_push_token')
      .eq('profile_id', job.recipient_profile_id).is('revoked_at', null)
    if (tokensResponse.error) continue
    const tokens = tokenSchema.parse(tokensResponse.data).map((token) => token.expo_push_token)
    const delivery = tokens.length === 0 ? { result: 'sent' as const, deviceNotRegistered: false }
      : await sendExpoPush(tokens, createNotificationPushTarget(job))
    if (delivery.deviceNotRegistered) {
      await admin.from('device_tokens').update({ revoked_at: new Date().toISOString() })
        .eq('profile_id', job.recipient_profile_id).in('expo_push_token', tokens)
      revoked += tokens.length
    }
    const finished = await admin.rpc('finish_notification_push_job', {
      p_job_id: job.id, p_succeeded: delivery.result === 'sent',
      p_last_error_code: delivery.result === 'retry' ? 'EXPO_PUSH_RETRY' : 'EXPO_PUSH_FAILED',
      p_next_retry_at: delivery.result === 'retry' && job.attempts < 5 ? retryAt(job.attempts) : null,
    })
    if (!finished.error && delivery.result === 'sent') sent += 1
    if (!finished.error && delivery.result === 'retry') retried += 1
  }
  logOperationalEvent('info', 'notification_push_worker_completed', { jobCount: jobs.length, completedCount: sent, retriedCount: retried, status: revoked })
  return Response.json({ claimed: jobs.length, sent, retried })
}

if (import.meta.main) Deno.serve(handleNotificationPushWorker)
