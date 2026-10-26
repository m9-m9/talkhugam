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
