import type { OcrPageSize } from '../../../packages/domain/src/ocrLayout.ts'

/** SOF 표식을 찾기 위해 base64 앞부분만 해독한다. 캔버스·사진 앱이 만든 JPEG는 이 안에 SOF가 있다. */
const JPEG_HEADER_BASE64_LENGTH = 262_144

/** 크기 정보를 담은 SOF 표식(0xC0~0xCF 중 DHT·JPG·DAC 제외)인지 판별한다. */
function isStartOfFrameMarker(marker: number): boolean {
  return marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)
}

/** base64 앞부분을 바이트 배열로 해독하고, 형식이 깨졌으면 null을 반환한다. */
function decodeHeaderBytes(base64: string): Uint8Array | null {
  const head = base64.slice(0, JPEG_HEADER_BASE64_LENGTH - (JPEG_HEADER_BASE64_LENGTH % 4))
  try {
    return Uint8Array.from(atob(head), (character) => character.charCodeAt(0))
  } catch {
    return null
  }
}

/** JPEG 바이트에서 SOF 표식을 찾아 픽셀 가로·세로를 읽고, 찾지 못하면 null을 반환한다. */
function findStartOfFrameSize(bytes: Uint8Array): OcrPageSize | null {
  let offset = 2
  while (offset + 9 < bytes.length && bytes[offset] === 0xff) {
    const marker = bytes[offset + 1] ?? 0
    const segmentLength = ((bytes[offset + 2] ?? 0) << 8) + (bytes[offset + 3] ?? 0)
    if (isStartOfFrameMarker(marker)) {
      const height = ((bytes[offset + 5] ?? 0) << 8) + (bytes[offset + 6] ?? 0)
      const width = ((bytes[offset + 7] ?? 0) << 8) + (bytes[offset + 8] ?? 0)
      return width > 0 && height > 0 ? { height, width } : null
    }
    offset += 2 + segmentLength
  }
  return null
}

/**
 * base64 JPEG의 헤더만 읽어 픽셀 크기를 반환한다. JPEG가 아니거나 크기를 찾지 못하면 null을 반환한다.
 * CLOVA OCR 응답은 JPEG 크기를 주지 않으므로 줄 박스를 0~1 비율로 바꿀 때 이 값을 쓴다.
 */
export function readJpegSize(base64: string): OcrPageSize | null {
  const bytes = decodeHeaderBytes(base64)
  if (!bytes || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  return findStartOfFrameSize(bytes)
}
