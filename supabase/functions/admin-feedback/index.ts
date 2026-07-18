import { z } from 'npm:zod@4.4.3'
import { createRequestId, failureResponse, successResponse } from '../_shared/api.ts'
import { parseJsonBody } from '../_shared/body.ts'
import { createCorsHeaders, optionsResponse } from '../_shared/cors.ts'
import { createAdminClient, getAuthenticatedContext } from '../_shared/supabase.ts'
import { adminFeedbackRequestSchema } from './schema.ts'

const feedbackTicketRowSchema = z.object({
  author_email_snapshot: z.string().min(3).max(320),
  author_profile_id: z.uuid(),
  body: z.string().min(1).max(2000),
  category: z.enum(['issue', 'feature', 'other']),
  created_at: z.string().datetime({ offset: true }),
  handled_at: z.string().datetime({ offset: true }).nullable(),
  handled_by_profile_id: z.uuid().nullable(),
  id: z.uuid(),
  status: z.enum(['unread', 'in_progress', 'completed']),
})

type OperatorContext = {
  profileId: string
}

/** 인증된 프로필이 운영함 허용 목록에 있는지 확인해 운영자 식별자를 반환한다. */
async function getOperatorContext(profileId: string): Promise<OperatorContext | null> {
  const response = await createAdminClient()
    .from('admin_users')
    .select('profile_id')
    .eq('profile_id', profileId)
    .maybeSingle()

  if (response.error || !response.data) return null
  return { profileId }
}

/** 운영함 목록과 상태 변경 요청을 운영자 권한으로만 처리한다. */
export async function handleAdminFeedback(request: Request): Promise<Response> {
  const preflight = optionsResponse(request)
  if (preflight) return preflight

  const requestId = createRequestId(request)
  const headers = {
    ...createCorsHeaders(request),
    'cache-control': 'private, no-store',
  }
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

  const operator = await getOperatorContext(auth.user.id)
  if (!operator) {
    return failureResponse(
      { code: 'ADMIN_FORBIDDEN', message: '운영함에 접근할 권한이 없습니다.' },
      requestId,
      403,
      headers,
    )
  }

  const body = await parseJsonBody(request, adminFeedbackRequestSchema)
  if (!body.ok) {
    return failureResponse(
      createAdminValidationError(body.field),
      requestId,
      400,
      headers,
    )
  }

  if (body.value.action === 'access') {
    return successResponse({ isAdmin: true }, requestId, headers)
  }
  if (body.value.action === 'list') {
    return await listFeedbackTickets(body.value.status, requestId, headers)
  }
  return await updateFeedbackStatus(
    body.value.ticketId,
    body.value.status,
    operator.profileId,
    requestId,
    headers,
  )
}

/** 검증 실패 경로가 있을 때만 표준 오류 응답에 해당 입력 필드를 포함한다. */
function createAdminValidationError(field: string | undefined) {
  if (field) return { code: 'VALIDATION_FAILED' as const, message: '운영함 요청을 확인해 주세요.', field }
  return { code: 'VALIDATION_FAILED' as const, message: '운영함 요청을 확인해 주세요.' }
}

/** 선택한 상태의 운영함 티켓을 최신 등록 순서로 반환한다. */
async function listFeedbackTickets(
  status: 'unread' | 'in_progress' | 'completed' | undefined,
  requestId: string,
  headers: HeadersInit,
): Promise<Response> {
  const client = createAdminClient()
  const query = client
    .from('feedback_tickets')
    .select(
      'id, category, body, author_profile_id, author_email_snapshot, status, created_at, handled_at, handled_by_profile_id',
    )
    .order('created_at', { ascending: false })
    .limit(100)
  const response = status ? await query.eq('status', status) : await query

  if (response.error) {
    return failureResponse(
      { code: 'INTERNAL_ERROR', message: '운영함을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.', retryable: true },
      requestId,
      500,
      headers,
    )
  }

  const tickets = z.array(feedbackTicketRowSchema).parse(response.data).map(mapFeedbackTicket)
  return successResponse({ tickets }, requestId, headers)
}

/** 운영자 선택 상태를 저장하고 실제로 바뀐 티켓의 요약 정보를 반환한다. */
async function updateFeedbackStatus(
  ticketId: string,
  status: 'unread' | 'in_progress' | 'completed',
  operatorProfileId: string,
  requestId: string,
  headers: HeadersInit,
): Promise<Response> {
  const handledMetadata = getHandledMetadata(status, operatorProfileId)
  const response = await createAdminClient()
    .from('feedback_tickets')
    .update({
      handled_at: handledMetadata.handledAt,
      handled_by_profile_id: handledMetadata.handledByProfileId,
      status,
    })
    .eq('id', ticketId)
    .select(
      'id, category, body, author_profile_id, author_email_snapshot, status, created_at, handled_at, handled_by_profile_id',
    )
    .maybeSingle()

  if (response.error) {
    return failureResponse(
      { code: 'INTERNAL_ERROR', message: '상태를 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.', retryable: true },
      requestId,
      500,
      headers,
    )
  }
  if (!response.data) {
    return failureResponse(
      { code: 'FEEDBACK_NOT_FOUND', message: '의견을 찾지 못했어요.' },
      requestId,
      404,
      headers,
    )
  }

  return successResponse({ ticket: mapFeedbackTicket(feedbackTicketRowSchema.parse(response.data)) }, requestId, headers)
}

/** 상태에 따라 처리 시각과 처리 운영자를 보관하거나 초기화할 값을 반환한다. */
function getHandledMetadata(
  status: 'unread' | 'in_progress' | 'completed',
  operatorProfileId: string,
): { handledAt: string | null; handledByProfileId: string | null } {
  if (status === 'unread') return { handledAt: null, handledByProfileId: null }
  return { handledAt: new Date().toISOString(), handledByProfileId: operatorProfileId }
}

/** DB의 snake_case 티켓 행을 운영 화면의 camelCase 모델로 변환한다. */
function mapFeedbackTicket(row: z.infer<typeof feedbackTicketRowSchema>) {
  return {
    authorEmailSnapshot: row.author_email_snapshot,
    authorProfileId: row.author_profile_id,
    body: row.body,
    category: row.category,
    createdAt: row.created_at,
    handledAt: row.handled_at,
    handledByProfileId: row.handled_by_profile_id,
    id: row.id,
    status: row.status,
  }
}

if (import.meta.main) Deno.serve(handleAdminFeedback)
