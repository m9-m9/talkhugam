import { z } from 'npm:zod@4.4.3'
import { createRequestId, failureResponse, successResponse } from '../_shared/api.ts'
import { parseJsonBody } from '../_shared/body.ts'
import { createCorsHeaders, optionsResponse } from '../_shared/cors.ts'
import { logOperationalEvent } from '../_shared/logger.ts'
import { createAdminClient, getAuthenticatedContext } from '../_shared/supabase.ts'
import { deleteProfileAvatar } from './avatar.ts'
import { executeAccountDeletion, type AccountDeletionExecution } from './finalization.ts'
import { accountDeleteInputSchema } from './schema.ts'

const preparedRequestSchema = z.array(z.object({
  request_id: z.uuid(),
  profile_id: z.uuid(),
})).min(1).max(1)

/** 계정 삭제 결과를 표준 성공 응답으로 변환한다. */
export function createAccountDeletionSuccessResponse(
  deletion: AccountDeletionExecution,
  deletionRequestId: string,
  requestId: string,
  headers: HeadersInit = {},
): Response {
  return successResponse(
    { ...deletion, requestId: deletionRequestId },
    requestId,
    { ...headers, 'cache-control': 'no-store' },
  )
}

/** 계정 삭제 요청이나 사용자 동작을 처리한다. */
export async function handleAccountDelete(request: Request): Promise<Response> {
  const preflight = optionsResponse(request)
  if (preflight) return preflight

  const requestId = createRequestId(request)
  const headers = createCorsHeaders(request)

  if (request.method !== 'POST') {
    return failureResponse(
      { code: 'VALIDATION_FAILED', message: '지원하지 않는 요청입니다.' },
      requestId,
      405,
      headers,
    )
  }

  const auth = await getAuthenticatedContext(request)
  if (!auth) {
    return failureResponse(
      { code: 'AUTH_REQUIRED', message: '로그인이 필요합니다.' },
      requestId,
      401,
      headers,
    )
  }

  const body = await parseJsonBody(request, accountDeleteInputSchema)
  if (!body.ok) {
    return failureResponse(
      { code: 'VALIDATION_FAILED', message: '삭제 방식을 선택해 주세요.' },
      requestId,
      400,
      headers,
    )
  }

  const admin = createAdminClient()
  let deletionRequestId: string | null = null
  let isAuthDeleted = false

  try {
    const prepareResponse = await auth.client.rpc('prepare_account_deletion', {
      p_mode: body.value.mode,
      p_request_id: crypto.randomUUID(),
    })
    if (prepareResponse.error) {
      const isOwnershipError = prepareResponse.error.message.includes('OWNER_TRANSFER_REQUIRED')
      return failureResponse(
        isOwnershipError
          ? { code: 'OWNER_TRANSFER_REQUIRED', message: '먼저 다른 멤버에게 방장을 넘겨 주세요.' }
          : { code: 'INTERNAL_ERROR', message: '계정 삭제를 준비하지 못했습니다.', retryable: true },
        requestId,
        isOwnershipError ? 409 : 500,
        headers,
      )
    }

    const [prepared] = preparedRequestSchema.parse(prepareResponse.data)
    if (!prepared) throw new Error('Prepared deletion request is required')
    deletionRequestId = prepared.request_id

    const isAvatarDeleted = await deleteProfileAvatar(admin, auth.user.id)
    if (!isAvatarDeleted) throw new Error('Profile avatar deletion failed')

    const deletion = await executeAccountDeletion(
      async () => {
        const deleteResponse = await admin.auth.admin.deleteUser(auth.user.id)
        if (!deleteResponse.error) isAuthDeleted = true
        return !deleteResponse.error
      },
      async () => {
        const finishResponse = await admin.rpc('finish_account_deletion', {
          p_request_id: prepared.request_id,
          p_succeeded: true,
          p_last_error: null,
        })
        return !finishResponse.error
      },
    )

    logOperationalEvent(
      deletion.completionPending ? 'warn' : 'info',
      deletion.completionPending ? 'account_delete_completion_pending' : 'account_delete_succeeded',
      { requestId, status: body.value.mode },
    )
    return createAccountDeletionSuccessResponse(deletion, prepared.request_id, requestId, headers)
  } catch {
    if (isAuthDeleted && deletionRequestId) {
      logOperationalEvent('warn', 'account_delete_completion_pending', { requestId, status: body.value.mode })
      return createAccountDeletionSuccessResponse(
        { completionPending: true, deleted: true },
        deletionRequestId,
        requestId,
        headers,
      )
    }

    if (deletionRequestId) {
      await admin.rpc('finish_account_deletion', {
        p_request_id: deletionRequestId,
        p_succeeded: false,
        p_last_error: 'AUTH_DELETE_FAILED',
      })
    }

    logOperationalEvent('error', 'account_delete_failed', { requestId, retryable: true })
    return failureResponse(
      { code: 'INTERNAL_ERROR', message: '계정 삭제를 완료하지 못했습니다.', retryable: true },
      requestId,
      502,
      { ...headers, 'cache-control': 'no-store' },
    )
  }
}

if (import.meta.main) Deno.serve(handleAccountDelete)
