/** Google Vision 인식 품질과 전송 크기의 균형을 위해 사진 긴 변을 이 크기로 줄인다. */
export const ocrPhotoMaxSide = 2000
const ocrPhotoJpegQuality = 0.8

type ImageSize = { height: number; width: number }

/** 원본 사진 크기를 받아 긴 변이 최대값을 넘지 않도록 비율을 유지한 크기를 반환한다. */
export function getScaledImageSize(size: ImageSize, maxSide = ocrPhotoMaxSide): ImageSize {
  const scale = Math.min(1, maxSide / Math.max(size.width, size.height))
  return { height: Math.round(size.height * scale), width: Math.round(size.width * scale) }
}

/** canvas 내용을 JPEG Blob으로 인코딩한다. */
function encodeCanvasAsJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('jpeg encode failed'))),
      'image/jpeg',
      ocrPhotoJpegQuality,
    )
  })
}

/** Blob을 data URL 접두어 없는 base64 문자열로 읽는다. */
function readBlobAsBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''))
    reader.onerror = () => reject(new Error('read failed'))
    reader.readAsDataURL(blob)
  })
}

/**
 * 사용자가 고른 사진 파일을 EXIF 회전을 반영해 긴 변 2000px JPEG로 줄이고
 * 서버 전송용 base64 문자열을 반환한다. 결과는 메모리에서만 쓰고 저장하지 않는다.
 */
export async function resizePhotoForOcr(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const size = getScaledImageSize({ height: bitmap.height, width: bitmap.width })
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('canvas unavailable')
    context.drawImage(bitmap, 0, 0, size.width, size.height)
    return await readBlobAsBase64(await encodeCanvasAsJpeg(canvas))
  } finally {
    bitmap.close()
  }
}
