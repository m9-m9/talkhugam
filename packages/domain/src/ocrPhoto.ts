/** CLOVA OCR 인식 품질과 전송 크기의 균형을 위해 사진 긴 변을 이 크기로 줄인다. */
export const ocrPhotoMaxSide = 2000

/** 사진을 줄여 JPEG로 다시 인코딩할 때 쓰는 품질(0~1). 웹 canvas와 모바일 manipulator가 함께 쓴다. */
export const ocrPhotoJpegQuality = 0.8

export type OcrImageSize = { height: number; width: number }

/** 원본 사진 크기를 받아 긴 변이 최대값을 넘지 않도록 비율을 유지한 크기를 반환한다. */
export function getScaledImageSize(size: OcrImageSize, maxSide = ocrPhotoMaxSide): OcrImageSize {
  const scale = Math.min(1, maxSide / Math.max(size.width, size.height))
  return { height: Math.round(size.height * scale), width: Math.round(size.width * scale) }
}

/** 사진을 서버로 보내기 전, 기기·브라우저에서 디코드·축소하지 못했음을 서버 인식 실패와 구분해 나타낸다. */
export class PhotoDecodeError extends Error {
  /** 원인 오류를 받아 사진 형식 오류를 만든다. 원인은 기록하지 않고 구분용으로만 둔다. */
  constructor(cause?: unknown) {
    super('photo decode failed', { cause })
    this.name = 'PhotoDecodeError'
  }
}

/** 오류가 사진 디코드·축소 실패인지 판단한다. */
export function isPhotoDecodeError(error: unknown): error is PhotoDecodeError {
  return error instanceof PhotoDecodeError
}
