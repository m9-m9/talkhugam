import { z } from 'npm:zod@4.4.3'
import { createRequestId, failureResponse, successResponse } from '../_shared/api.ts'
import { parseJsonBody } from '../_shared/body.ts'
import { createCorsHeaders, optionsResponse } from '../_shared/cors.ts'
import { readRequiredEnv } from '../_shared/env.ts'
import { logOperationalEvent } from '../_shared/logger.ts'
import { createDirectUpload, deleteDirectUpload, getDirectUpload } from '../_shared/mux.ts'
import { createAdminClient, getAuthenticatedContext } from '../_shared/supabase.ts'
import { muxCreateUploadInputSchema } from './schema.ts'

const postIdSchema = z.uuid()

export async function handleMuxCreateUpload(request: Request): Promise<Response> {
  const preflight = optionsResponse(request)
  if (preflight) return preflight

  const requestId = createRequestId(request)
  const headers = createCorsHeaders(request)
  const origin = request.headers.get('origin')

  if (request.method !== 'POST') {
    return failureResponse(
      { code: 'VALIDATION_FAILED', message: '지원하지 않는 요청입니다.' },
      requestId,
      405,
      headers,
    )
  }

  if (!origin || new Headers(headers).get('access-control-allow-origin') === 'null') {
    return failureResponse(
      { code: 'VALIDATION_FAILED', message: '허용되지 않은 업로드 출처입니다.' },
      requestId,
      403,
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

  const body = await parseJsonBody(request, muxCreateUploadInputSchema)
  if (!body.ok) {
    return failureResponse(
      { code: 'VALIDATION_FAILED', message: '영상 정보를 확인해 주세요.' },
      requestId,
      400,
      headers,
    )
  }

  try {
    const postResponse = await auth.client.rpc('create_post', {
      p_book_chat_id: body.value.bookChatId,
      p_client_id: body.value.clientId,
      p_type: 'video',
      p_body: body.value.caption ?? null,
      p_labels: body.value.labels,
      p_mentioned_member_ids: [...new Set(body.value.mentionedMemberIds)],
    })
    if (postResponse.error) throw postResponse.error
    const postId = postIdSchema.parse(postResponse.data)

    const admin = createAdminClient()
    const credentials = {
      tokenId: readRequiredEnv('MUX_TOKEN_ID'),
      tokenSecret: readRequiredEnv('MUX_TOKEN_SECRET'),
    }
    const existingResponse = await admin
      .from('video_assets')
      .select('mux_upload_id')
      .eq('post_id', postId)
      .maybeSingle()
    if (existingResponse.error) throw existingResponse.error

    if (existingResponse.data) {
      const upload = await getDirectUpload(credentials, existingResponse.data.mux_upload_id)
      return successResponse(
        { postId, uploadId: upload.id, uploadUrl: upload.url },
        requestId,
        headers,
      )
    }

    const upload = await createDirectUpload(credentials, { corsOrigin: origin, postId })
    const assetResponse = await admin.from('video_assets').insert({
      post_id: postId,
      mux_upload_id: upload.id,
      status: 'waiting_upload',
    })

    if (assetResponse.error) {
      await deleteDirectUpload(credentials, upload.id).catch(() => undefined)
      throw assetResponse.error
    }

    logOperationalEvent('info', 'mux_upload_started', { requestId, status: 'waiting_upload' })
    return successResponse(
      { postId, uploadId: upload.id, uploadUrl: upload.url },
      requestId,
      headers,
      201,
    )
  } catch {
    logOperationalEvent('error', 'mux_upload_failed', { requestId, retryable: true })
    return failureResponse(
      { code: 'VIDEO_UPLOAD_FAILED', message: '영상 업로드를 시작하지 못했습니다.', retryable: true },
      requestId,
      502,
      headers,
    )
  }
}

if (import.meta.main) Deno.serve(handleMuxCreateUpload)
