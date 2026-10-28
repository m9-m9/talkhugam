import { groupClovaFieldsIntoLines, type OcrLine } from '../../../packages/domain/src/ocrLayout.ts'
import { readJpegSize } from './jpegSize.ts'
import { clovaOcrResponseSchema } from './schema.ts'

export type { OcrLine }

export type ClovaOcrConfig = {
  invokeUrl: string
  secret: string
}

export class ClovaOcrError extends Error {
  /** CLOVA 실패 상태와 재시도 가능 여부만 담고, 상류 메시지(이미지 정보가 섞일 수 있음)는 버린다. */
  constructor(
    readonly upstreamStatus: number,
    readonly isRetryable: boolean,
  ) {
    super('CLOVA OCR failed')
    this.name = 'ClovaOcrError'
  }
}

/** base64 JPEG와 요청 식별자를 받아 한국어 CLOVA OCR General V2 요청 본문을 만든다. */
export function createClovaRequestBody(imageContent: string, requestId: string, timestamp: number) {
  return {
    version: 'V2',
    requestId,
    timestamp,
    lang: 'ko',
    images: [{ format: 'jpg', name: 'page', data: imageContent }],
  }
}

/** 도메인별 호출 주소 끝에 `/general`이 없으면 붙여 General OCR 주소를 만든다. */
export function resolveClovaGeneralUrl(invokeUrl: string): string {
  const trimmed = invokeUrl.replace(/\/+$/, '')
  return trimmed.endsWith('/general') ? trimmed : `${trimmed}/general`
}

/**
 * base64 JPEG와 CLOVA 설정으로 General OCR을 동기 호출하고 줄 단위 `{ id, text, box }` 목록을 반환한다.
 * 이미지와 인식 결과는 이 함수의 메모리 안에서만 다루고 어디에도 기록하지 않는다.
 */
export async function fetchClovaLines(
  imageContent: string,
  config: ClovaOcrConfig,
  fetcher: typeof fetch = fetch,
): Promise<OcrLine[]> {
  const pageSize = readJpegSize(imageContent)
  if (!pageSize) throw new ClovaOcrError(400, false)

  const response = await fetcher(resolveClovaGeneralUrl(config.invokeUrl), {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-ocr-secret': config.secret,
    },
    body: JSON.stringify(createClovaRequestBody(imageContent, crypto.randomUUID(), Date.now())),
  })

  if (!response.ok) {
    throw new ClovaOcrError(response.status, response.status === 429 || response.status >= 500)
  }

  const parsed = clovaOcrResponseSchema.safeParse(await response.json())
  if (!parsed.success) throw new ClovaOcrError(response.status, true)

  const result = parsed.data.images?.[0]
  if (result?.inferResult && result.inferResult !== 'SUCCESS') {
    throw new ClovaOcrError(response.status, result.inferResult === 'ERROR')
  }

  return groupClovaFieldsIntoLines(result?.fields, pageSize)
}
