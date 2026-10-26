// 이 파일은 Edge Function(Deno)도 상대 경로로 가져다 쓰므로 외부 import 없이 순수 TypeScript로 유지한다.

export type OcrBox = {
  height: number
  width: number
  x: number
  y: number
}

export type OcrLine = {
  box: OcrBox
  id: string
  text: string
}

type ClovaVertex = { x?: number | undefined; y?: number | undefined }

export type ClovaField = {
  boundingPoly?: { vertices?: ClovaVertex[] | undefined } | undefined
  inferText?: string | undefined
  lineBreak?: boolean | undefined
}

export type OcrPageSize = { height: number; width: number }

type PixelBounds = { maxX: number; maxY: number; minX: number; minY: number }

type LineDraft = { bounds: PixelBounds | null; text: string }

/** 0~1 범위를 벗어난 비율 값을 경계로 자르고 소수 넷째 자리로 반올림한다. */
function clampRatio(value: number): number {
  const clamped = Math.min(1, Math.max(0, value))
  return Math.round(clamped * 10000) / 10000
}

/** 필드 꼭짓점 목록을 픽셀 경계 사각형으로 바꾼다. 꼭짓점이 없으면 null을 반환한다. */
function getFieldBounds(field: ClovaField): PixelBounds | null {
  const vertices = field.boundingPoly?.vertices ?? []
  if (vertices.length === 0) return null
  const xs = vertices.map((vertex) => vertex.x ?? 0)
  const ys = vertices.map((vertex) => vertex.y ?? 0)
  return { maxX: Math.max(...xs), maxY: Math.max(...ys), minX: Math.min(...xs), minY: Math.min(...ys) }
}

/** 두 픽셀 경계 사각형을 모두 덮는 사각형을 반환한다. */
function mergeBounds(current: PixelBounds | null, next: PixelBounds | null): PixelBounds | null {
  if (!current) return next
  if (!next) return current
  return {
    maxX: Math.max(current.maxX, next.maxX),
    maxY: Math.max(current.maxY, next.maxY),
    minX: Math.min(current.minX, next.minX),
    minY: Math.min(current.minY, next.minY),
  }
}

/** 픽셀 경계를 페이지 크기로 나눠 화면 배치용 0~1 비율 박스로 바꾼다. */
function normalizeBounds(bounds: PixelBounds, pageWidth: number, pageHeight: number): OcrBox {
  const x = clampRatio(bounds.minX / pageWidth)
  const y = clampRatio(bounds.minY / pageHeight)
  return {
    height: clampRatio(clampRatio(bounds.maxY / pageHeight) - y),
    width: clampRatio(clampRatio(bounds.maxX / pageWidth) - x),
    x,
    y,
  }
}

/** 필드 목록을 읽기 순서대로 이어 lineBreak가 true인 필드에서 줄 초안을 닫는다. 마지막 줄은 lineBreak가 없어도 닫는다. */
function collectLineDrafts(fields: ClovaField[]): LineDraft[] {
  const drafts: LineDraft[] = []
  let current: LineDraft = { bounds: null, text: '' }

  for (const [index, field] of fields.entries()) {
    current.text += `${field.inferText ?? ''} `
    current.bounds = mergeBounds(current.bounds, getFieldBounds(field))
    if (!field.lineBreak && index < fields.length - 1) continue
    drafts.push(current)
    current = { bounds: null, text: '' }
  }

  return drafts
}

/**
 * CLOVA OCR General V2의 `fields`와 인식한 이미지의 픽셀 크기를 받아
 * `lineBreak`로 줄을 묶고, 페이지 비율 박스를 가진 줄 목록을 반환한다.
 */
export function groupClovaFieldsIntoLines(
  fields: ClovaField[] | undefined,
  pageSize: OcrPageSize | null,
): OcrLine[] {
  if (!fields?.length || !pageSize?.width || !pageSize.height) return []
  const { height: pageHeight, width: pageWidth } = pageSize

  return collectLineDrafts(fields)
    .map((draft) => ({ bounds: draft.bounds, text: draft.text.replace(/\s+/g, ' ').trim() }))
    .filter((draft): draft is { bounds: PixelBounds; text: string } =>
      Boolean(draft.text && draft.bounds),
    )
    .map((draft, index) => ({
      box: normalizeBounds(draft.bounds, pageWidth, pageHeight),
      id: `line-${index}`,
      text: draft.text,
    }))
}
