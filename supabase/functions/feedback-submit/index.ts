import { createRequestId, failureResponse, successResponse } from '../_shared/api.ts'
import { parseJsonBody } from '../_shared/body.ts'
import { createCorsHeaders, optionsResponse } from '../_shared/cors.ts'
import { createAdminClient, getAuthenticatedContext } from '../_shared/supabase.ts'
import { feedbackSubmissionSchema } from './schema.ts'

/** 로그인한 이용자의 의견을 운영함에 저장하고 생성된 티켓 식별자를 반환한다. */
export async function handleFeedbackSubmit(request: Request): Promise<Response> {
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

  const body = await parseJsonBody(request, feedbackSubmissionSchema)
  if (!body.ok) {
    return failureResponse(
      createFeedbackValidationError(body.field),
      requestId,
      400,
      headers,
    )
  }

  const email = auth.user.email?.trim()
  if (!email) {
    return failureResponse(
      { code: 'PROFILE_REQUIRED', message: '이메일이 확인된 계정에서 의견을 남길 수 있어요.' },
      requestId,
      400,
      headers,
    )
  }

  const response = await createAdminClient()
    .from('feedback_tickets')
    .insert({
      author_email_snapshot: email,
      author_profile_id: auth.user.id,
      body: body.value.body,
      category: body.value.category,
    })
    .select('id')
    .single()

  if (response.error) {
    return failureResponse(
      { code: 'INTERNAL_ERROR', message: '의견을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.', retryable: true },
      requestId,
      500,
      headers,
    )
  }

  return successResponse({ ticketId: response.data.id }, requestId, headers, 201)
}

/** 검증 실패 경로가 있을 때만 표준 오류 응답에 해당 입력 필드를 포함한다. */
function createFeedbackValidationError(field: string | undefined) {
  if (field) return { code: 'VALIDATION_FAILED' as const, message: '의견 내용을 확인해 주세요.', field }
  return { code: 'VALIDATION_FAILED' as const, message: '의견 내용을 확인해 주세요.' }
}

if (import.meta.main) Deno.serve(handleFeedbackSubmit)
