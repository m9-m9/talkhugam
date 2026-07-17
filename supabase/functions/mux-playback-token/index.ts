import { z } from 'npm:zod@4.4.3'
import { createRequestId, failureResponse, successResponse } from '../_shared/api.ts'
import { parseJsonBody } from '../_shared/body.ts'
import { createCorsHeaders, optionsResponse } from '../_shared/cors.ts'
import { readRequiredEnv } from '../_shared/env.ts'
import { logOperationalEvent } from '../_shared/logger.ts'
import { signPlaybackToken } from '../_shared/mux.ts'
import { getAuthenticatedContext } from '../_shared/supabase.ts'
import { muxPlaybackTokenInputSchema } from './schema.ts'

const videoAssetSchema = z.object({
  playback_id: z.string().min(1),
  status: z.literal('ready'),
})

export async function handleMuxPlaybackToken(request: Request): Promise<Response> {
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

  const body = await parseJsonBody(request, muxPlaybackTokenInputSchema)
  if (!body.ok) {
    return failureResponse(
      { code: 'VALIDATION_FAILED', message: '재생 정보를 확인해 주세요.' },
      requestId,
      400,
      headers,
    )
  }

  try {
    const assetResponse = await auth.client
      .from('video_assets')
      .select('playback_id, status')
      .eq('post_id', body.value.postId)
      .eq('status', 'ready')
      .single()

    if (assetResponse.error) {
      return failureResponse(
        { code: 'POST_NOT_FOUND', message: '재생 가능한 영상을 찾지 못했습니다.' },
        requestId,
        404,
        headers,
      )
    }

    const asset = videoAssetSchema.parse(assetResponse.data)
    const nowSeconds = Math.floor(Date.now() / 1000)
    const expiresAt = nowSeconds + 300
    const token = await signPlaybackToken(
      asset.playback_id,
      readRequiredEnv('MUX_SIGNING_KEY_ID'),
      readRequiredEnv('MUX_SIGNING_PRIVATE_KEY'),
      nowSeconds,
      300,
    )
    const thumbnailToken = await signPlaybackToken(
      asset.playback_id,
      readRequiredEnv('MUX_SIGNING_KEY_ID'),
      readRequiredEnv('MUX_SIGNING_PRIVATE_KEY'),
      nowSeconds,
      300,
      't',
    )

    return successResponse(
      { playbackId: asset.playback_id, thumbnailToken, token, expiresAt },
      requestId,
      headers,
    )
  } catch {
    logOperationalEvent('error', 'mux_playback_token_failed', { requestId, retryable: true })
    return failureResponse(
      { code: 'INTERNAL_ERROR', message: '재생 권한을 만들지 못했습니다.', retryable: true },
      requestId,
      500,
      headers,
    )
  }
}

if (import.meta.main) Deno.serve(handleMuxPlaybackToken)
