import { createRequestId, failureResponse, successResponse } from '../_shared/api.ts'
import { parseJsonBody } from '../_shared/body.ts'
import { createCorsHeaders, optionsResponse } from '../_shared/cors.ts'
import { readOptionalEnv } from '../_shared/env.ts'
import { logOperationalEvent } from '../_shared/logger.ts'
import { consumeRateLimit } from '../_shared/rate-limit.ts'
import { getAuthenticatedContext } from '../_shared/supabase.ts'
import { ocrPageInputSchema } from './schema.ts'
import { type ClovaOcrConfig, fetchClovaLines, type OcrLine } from './clova.ts'

/** 사용자별 하루 OCR 호출 상한. CLOVA OCR 비용 보호용이며 운영 결정에 따라 조정한다. */
export const OCR_DAILY_LIMIT_PER_USER = 20
const ONE_DAY_SECONDS = 86_400

export type OcrPageUser = {
  userId: string
  isBookChatMember: (bookChatId: string) => Promise<boolean>
}

export type OcrPageDependencies = {
  authenticate: (request: Request) => Promise<OcrPageUser | null>
  consumeDailyLimit: (userId: string) => Promise<boolean>
  readOcrConfig: () => ClovaOcrConfig | undefined
  recognizeLines: (imageContent: string, config: ClovaOcrConfig) => Promise<OcrLine[]>
}

/** 요청 JWT를 검증하고, 사용자 권한(RLS)으로 책 대화방을 읽어 구성원 여부를 확인하는 함수를 함께 반환한다. */
async function authenticateWithSupabase(request: Request): Promise<OcrPageUser | null> {
  const auth = await getAuthenticatedContext(request)
  if (!auth) return null
  const client = auth.client

  /** book_chats RLS(활성 책방 구성원만 조회)로 해당 책 대화방이 보이는지 확인한다. */
  async function isBookChatMember(bookChatId: string): Promise<boolean> {
    const { data, error } = await client
      .from('book_chats')
      .select('id')
      .eq('id', bookChatId)
      .maybeSingle()
    if (error) throw error
    return data !== null
  }

  return { userId: auth.user.id, isBookChatMember }
}

/** 기존 consume_rate_limit RPC로 사용자별 24시간 고정 창 호출 수를 소비하고 허용 여부를 반환한다. */
function consumeOcrDailyLimit(userId: string): Promise<boolean> {
  return consumeRateLimit({
    bucket: 'ocr-page',
    subject: userId,
    limit: OCR_DAILY_LIMIT_PER_USER,
    windowSeconds: ONE_DAY_SECONDS,
  })
}

/** Edge Function 시크릿에서 CLOVA OCR 호출 주소와 Secret을 읽고, 하나라도 없으면 undefined를 반환한다. */
function readClovaConfigFromEnv(): ClovaOcrConfig | undefined {
  const invokeUrl = readOptionalEnv('CLOVA_OCR_INVOKE_URL')
  const secret = readOptionalEnv('CLOVA_OCR_SECRET')
  return invokeUrl && secret ? { invokeUrl, secret } : undefined
}

/** base64 이미지와 CLOVA 설정으로 실제 CLOVA OCR을 호출해 줄 목록을 반환한다. */
function recognizeLinesWithClova(imageContent: string, config: ClovaOcrConfig): Promise<OcrLine[]> {
  return fetchClovaLines(imageContent, config)
}

const defaultDependencies: OcrPageDependencies = {
  authenticate: authenticateWithSupabase,
  consumeDailyLimit: consumeOcrDailyLimit,
  readOcrConfig: readClovaConfigFromEnv,
  recognizeLines: recognizeLinesWithClova,
}

/** 인증·구성원·키·호출 제한을 통과한 요청의 이미지를 인식해 줄 목록 응답을 만든다. 실패 내용은 코드만 기록한다. */
async function recognizeAuthorizedPage(
  dependencies: OcrPageDependencies,
  user: OcrPageUser,
  input: { bookChatId: string; image: string },
  requestId: string,
  headers: HeadersInit,
): Promise<Response> {
  if (!(await user.isBookChatMember(input.bookChatId))) {
    return failureResponse(
      { code: 'ROOM_FORBIDDEN', message: '이 책방의 구성원만 사용할 수 있어요.' },
      requestId,
      403,
      headers,
    )
  }

  const config = dependencies.readOcrConfig()
  if (!config) {
    logOperationalEvent('error', 'ocr_page_unconfigured', { requestId, code: 'OCR_UNAVAILABLE' })
    return failureResponse(
      { code: 'OCR_UNAVAILABLE', message: '문장 인식이 아직 준비되지 않았어요. CLOVA_OCR_INVOKE_URL·CLOVA_OCR_SECRET 설정이 필요합니다.' },
      requestId,
      503,
      headers,
    )
  }

  if (!(await dependencies.consumeDailyLimit(user.userId))) {
    return failureResponse(
      { code: 'RATE_LIMITED', message: '오늘 사진 인식 횟수를 모두 썼어요. 내일 다시 시도해 주세요.' },
      requestId,
      429,
      headers,
    )
  }

  const lines = await dependencies.recognizeLines(input.image, config)
  return successResponse({ lines }, requestId, headers)
}

/**
 * 책 페이지 사진(base64 JPEG)과 책 대화방 ID를 받아 JWT·구성원·일일 호출 제한을 확인한 뒤
 * CLOVA OCR로 읽은 줄 목록만 반환하는 ocr-page handler를 만든다.
 * 이미지와 인식 결과는 로그·DB·Storage에 남기지 않는다.
 */
export function createOcrPageHandler(dependencies: OcrPageDependencies) {
  /** ocr-page HTTP 요청을 처리한다. */
  return async function handleRequest(request: Request): Promise<Response> {
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

    const user = await dependencies.authenticate(request)
    if (!user) {
      return failureResponse({ code: 'AUTH_REQUIRED', message: '로그인이 필요합니다.' }, requestId, 401, headers)
    }

    const body = await parseJsonBody(request, ocrPageInputSchema)
    if (!body.ok) {
      return failureResponse(
        { code: 'VALIDATION_FAILED', message: '사진을 다시 골라 주세요.' },
        requestId,
        400,
        headers,
      )
    }

    try {
      return await recognizeAuthorizedPage(dependencies, user, body.value, requestId, headers)
    } catch {
      logOperationalEvent('error', 'ocr_page_failed', { requestId, code: 'OCR_FAILED', retryable: true })
      return failureResponse(
        { code: 'OCR_FAILED', message: '문장을 읽지 못했어요. 잠시 후 다시 시도해 주세요.', retryable: true },
        requestId,
        502,
        headers,
      )
    }
  }
}

export const handleOcrPage = createOcrPageHandler(defaultDependencies)

if (import.meta.main) Deno.serve(handleOcrPage)
