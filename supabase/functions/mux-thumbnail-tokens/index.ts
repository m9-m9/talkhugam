import { z } from 'npm:zod@4.4.3'
import { createRequestId, failureResponse, successResponse } from '../_shared/api.ts'
import { parseJsonBody } from '../_shared/body.ts'
import { createCorsHeaders, optionsResponse } from '../_shared/cors.ts'
import { readRequiredEnv } from '../_shared/env.ts'
import { logOperationalEvent } from '../_shared/logger.ts'
import { signPlaybackToken } from '../_shared/mux.ts'
import { getAuthenticatedContext } from '../_shared/supabase.ts'
import { muxThumbnailTokensInputSchema } from './schema.ts'

const videoAssetSchema = z.object({
  playback_id: z.string().min(1),
  post_id: z.uuid(),
  status: z.literal('ready'),
})

/** 영상 보관함에 표시할 Mux 썸네일 권한을 한 번에 발급한다. */
export async function handleMuxThumbnailTokens(request: Request): Promise<Response> {
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

  const body = await parseJsonBody(request, muxThumbnailTokensInputSchema)
  if (!body.ok) {
    return failureResponse(
      { code: 'VALIDATION_FAILED', message: '영상 정보를 확인해 주세요.' },
      requestId,
      400,
      headers,
    )
  }

  const postIds = [...new Set(body.value.postIds)]
  const assetResponse = await auth.client
    .from('video_assets')
    .select('post_id, playback_id, status')
    .in('post_id', postIds)
    .eq('status', 'ready')

  if (assetResponse.error) {
    return failureResponse(
      { code: 'POST_NOT_FOUND', message: '영상 미리보기를 찾지 못했습니다.' },
      requestId,
      404,
      headers,
    )
  }

  try {
    const assets = z.array(videoAssetSchema).parse(assetResponse.data)
    const nowSeconds = Math.floor(Date.now() / 1000)
    const expiresAt = nowSeconds + 300
    const keyId = readRequiredEnv('MUX_SIGNING_KEY_ID')
    const privateKey = readRequiredEnv('MUX_SIGNING_PRIVATE_KEY')
    const thumbnails = await Promise.all(
      assets.map(async (asset) => ({
        expiresAt,
        playbackId: asset.playback_id,
        postId: asset.post_id,
        thumbnailToken: await signPlaybackToken(
          asset.playback_id,
          keyId,
          privateKey,
          nowSeconds,
          300,
          't',
          { time: 0 },
        ),
      })),
    )

    return successResponse({ thumbnails }, requestId, headers)
  } catch (error) {
    const code = getThumbnailSigningErrorCode(error)
    logOperationalEvent('error', 'mux_thumbnail_tokens_failed', { requestId, code, retryable: true })
    return failureResponse(
      { code: 'INTERNAL_ERROR', message: '영상 미리보기를 만들지 못했습니다.', retryable: true },
      requestId,
      500,
      headers,
    )
  }
}

/** 영상 썸네일 서명 오류를 사용자용 오류 코드로 변환한다. */
function getThumbnailSigningErrorCode(error: unknown): string {
  if (!(error instanceof Error)) return 'THUMBNAIL_TOKEN_UNKNOWN'
  if (error.message.startsWith('Missing required environment variable')) {
    return 'THUMBNAIL_TOKEN_SECRET_MISSING'
  }
  if (error.message.includes('PEM') || error.message.includes('PKCS')) {
    return 'THUMBNAIL_TOKEN_KEY_INVALID'
  }
  return 'THUMBNAIL_TOKEN_SIGNING_FAILED'
}

if (import.meta.main) Deno.serve(handleMuxThumbnailTokens)
