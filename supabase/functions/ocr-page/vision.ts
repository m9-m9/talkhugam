import { groupVisionWordsIntoLines, type OcrLine } from '../../../packages/domain/src/ocrLayout.ts'
import { visionAnnotateResponseSchema } from './schema.ts'

export type { OcrLine }

const VISION_ANNOTATE_ENDPOINT = 'https://vision.googleapis.com/v1/images:annotate'

export class VisionOcrError extends Error {
  /** Vision 실패 상태와 재시도 가능 여부만 담고, 상류 메시지(이미지 정보가 섞일 수 있음)는 버린다. */
  constructor(
    readonly upstreamStatus: number,
    readonly isRetryable: boolean,
  ) {
    super('Google Vision OCR failed')
    this.name = 'VisionOcrError'
  }
}

/** base64 이미지를 받아 한국어 우선 DOCUMENT_TEXT_DETECTION 요청 본문을 만든다. */
export function createVisionRequestBody(imageContent: string) {
  return {
    requests: [
      {
        image: { content: imageContent },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
        imageContext: { languageHints: ['ko', 'en'] },
      },
    ],
  }
}

/**
 * base64 이미지와 API 키로 Google Vision을 동기 호출하고 줄 단위 `{ id, text, box }` 목록을 반환한다.
 * 이미지와 인식 결과는 이 함수의 메모리 안에서만 다루고 어디에도 기록하지 않는다.
 */
export async function fetchVisionLines(
  imageContent: string,
  apiKey: string,
  fetcher: typeof fetch = fetch,
): Promise<OcrLine[]> {
  const response = await fetcher(VISION_ANNOTATE_ENDPOINT, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(createVisionRequestBody(imageContent)),
  })

  if (!response.ok) {
    throw new VisionOcrError(response.status, response.status === 429 || response.status >= 500)
  }

  const parsed = visionAnnotateResponseSchema.safeParse(await response.json())
  if (!parsed.success) throw new VisionOcrError(response.status, true)

  const result = parsed.data.responses?.[0]
  if (result?.error) throw new VisionOcrError(response.status, false)

  return groupVisionWordsIntoLines(result?.fullTextAnnotation)
}
