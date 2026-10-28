import { getScaledImageSize, ocrPhotoJpegQuality } from '@talkhugam/domain'

import { PhotoDecodeError } from './photoDecodeError'

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

/** 사진 파일을 EXIF 회전을 반영해 비트맵으로 디코드한다. 브라우저가 못 여는 형식이면 PhotoDecodeError를 던진다. */
async function decodePhotoBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch (error) {
    throw new PhotoDecodeError(error)
  }
}

/**
 * 사용자가 고른 사진 파일을 EXIF 회전을 반영해 긴 변 2000px JPEG로 줄이고
 * 서버 전송용 base64 문자열을 반환한다. 디코드에 실패하면(HEIC 등) 서버를 부르기 전에 PhotoDecodeError로 멈춘다.
 * 결과는 메모리에서만 쓰고 저장하지 않는다.
 */
export async function resizePhotoForOcr(file: File): Promise<string> {
  const bitmap = await decodePhotoBitmap(file)
  try {
    const size = getScaledImageSize({ height: bitmap.height, width: bitmap.width })
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const context = canvas.getContext('2d')
    if (!context) throw new PhotoDecodeError()
    context.drawImage(bitmap, 0, 0, size.width, size.height)
    return await readBlobAsBase64(await encodeCanvasAsJpeg(canvas))
  } finally {
    bitmap.close()
  }
}
