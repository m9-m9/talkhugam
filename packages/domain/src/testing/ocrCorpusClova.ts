import type { ClovaField, OcrPageSize } from '../ocrLayout'

/**
 * OCR 시험 코퍼스용 CLOVA OCR 녹화·실호출 도구. 테스트에서만 쓴다.
 * 녹화 파일에는 줄 묶기에 필요한 글자·좌표·줄 끝 여부만 남긴다(코퍼스 글은 직접 쓴 글이라 커밋해도 된다).
 */

export type OcrCorpusMode = 'live' | 'record' | 'replay'

export type ClovaRecording = {
  fields: ClovaField[]
  imageSize: OcrPageSize
}

export type ClovaTestConfig = { invokeUrl: string; secret: string }

/** OCR_CORPUS_MODE 값을 읽어 모드를 정한다. 없거나 모르는 값이면 녹화 재생(replay)이다. */
export function readOcrCorpusMode(value: string | undefined): OcrCorpusMode {
  return value === 'live' || value === 'record' ? value : 'replay'
}

/** 실호출 모드에 필요한 CLOVA 호출 주소·Secret을 환경 변수에서 읽는다. 없으면 무엇이 빠졌는지 알려 주는 오류를 던진다. */
export function readClovaTestConfig(env: Record<string, string | undefined>): ClovaTestConfig {
  const invokeUrl = env.CLOVA_OCR_INVOKE_URL
  const secret = env.CLOVA_OCR_SECRET
  if (!invokeUrl || !secret)
    throw new Error(
      'CLOVA_OCR_INVOKE_URL·CLOVA_OCR_SECRET이 없습니다. scripts/with-clova-secret.sh로 실행하세요.',
    )
  return { invokeUrl, secret }
}

/** CLOVA 응답 필드에서 줄 묶기에 쓰는 값만 남긴다. */
function pickLayoutField(field: ClovaField): ClovaField {
  return {
    boundingPoly: field.boundingPoly,
    inferText: field.inferText,
    lineBreak: field.lineBreak,
  }
}

/** base64 JPEG를 CLOVA OCR General V2로 한 번 인식시키고 녹화 형식으로 돌려준다. 실패하면 상태 코드만 담아 던진다. */
export async function requestClovaRecording(
  imageBase64: string,
  imageSize: OcrPageSize,
  config: ClovaTestConfig,
): Promise<ClovaRecording> {
  const base = config.invokeUrl.replace(/\/+$/, '')
  const response = await fetch(base.endsWith('/general') ? base : `${base}/general`, {
    body: JSON.stringify({
      images: [{ data: imageBase64, format: 'jpg', name: 'page' }],
      lang: 'ko',
      requestId: crypto.randomUUID(),
      timestamp: Date.now(),
      version: 'V2',
    }),
    headers: { 'content-type': 'application/json', 'x-ocr-secret': config.secret },
    method: 'POST',
  })
  if (!response.ok) throw new Error(`CLOVA OCR 실패: HTTP ${response.status}`)
  const payload = (await response.json()) as {
    images?: Array<{ fields?: ClovaField[]; inferResult?: string }>
  }
  const image = payload.images?.[0]
  if (image?.inferResult !== 'SUCCESS')
    throw new Error(`CLOVA OCR 실패: ${image?.inferResult ?? '응답 없음'}`)
  return { fields: (image.fields ?? []).map(pickLayoutField), imageSize }
}
