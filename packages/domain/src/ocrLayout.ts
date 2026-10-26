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

type VisionVertex = { x?: number | undefined; y?: number | undefined }

type VisionSymbol = {
  property?: { detectedBreak?: { type?: string | undefined } | undefined } | undefined
  text?: string | undefined
}

type VisionWord = {
  boundingBox?: { vertices?: VisionVertex[] | undefined } | undefined
  symbols?: VisionSymbol[] | undefined
}

type VisionPage = {
  blocks?:
    | { paragraphs?: { words?: VisionWord[] | undefined }[] | undefined }[]
    | undefined
  height?: number | undefined
  width?: number | undefined
}

export type VisionTextAnnotation = {
  pages?: VisionPage[] | undefined
}

type PixelBounds = { maxX: number; maxY: number; minX: number; minY: number }

type LineDraft = { bounds: PixelBounds | null; text: string }

const lineEndingBreaks = new Set(['EOL_SURE_SPACE', 'LINE_BREAK', 'HYPHEN'])
const spaceBreaks = new Set(['SPACE', 'SURE_SPACE'])

/** 0~1 범위를 벗어난 비율 값을 경계로 자르고 소수 넷째 자리로 반올림한다. */
function clampRatio(value: number): number {
  const clamped = Math.min(1, Math.max(0, value))
  return Math.round(clamped * 10000) / 10000
}

/** 단어 꼭짓점 목록을 픽셀 경계 사각형으로 바꾼다. 꼭짓점이 없으면 null을 반환한다. */
function getWordBounds(word: VisionWord): PixelBounds | null {
  const vertices = word.boundingBox?.vertices ?? []
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

/** 글자 하나의 텍스트와 detectedBreak를 줄 초안에 덧붙이고 줄이 끝났는지 반환한다. */
function appendSymbol(draft: LineDraft, symbol: VisionSymbol): boolean {
  const breakType = symbol.property?.detectedBreak?.type ?? ''
  draft.text += symbol.text ?? ''
  if (spaceBreaks.has(breakType)) draft.text += ' '
  if (breakType === 'HYPHEN') draft.text += '-'
  return lineEndingBreaks.has(breakType)
}

/** 페이지 하나의 단어를 순서대로 읽어 줄 초안 목록으로 묶는다. */
function collectPageLineDrafts(page: VisionPage): LineDraft[] {
  const drafts: LineDraft[] = []
  const words = (page.blocks ?? []).flatMap((block) =>
    (block.paragraphs ?? []).flatMap((paragraph) => [...(paragraph.words ?? []), null]),
  )
  let current: LineDraft = { bounds: null, text: '' }

  for (const word of words) {
    const isLineEnded = word ? appendWord(current, word) : true
    if (!isLineEnded) continue
    drafts.push(current)
    current = { bounds: null, text: '' }
  }

  return drafts
}

/** 단어 하나를 줄 초안에 더하고 마지막 글자에서 줄이 끝났는지 반환한다. */
function appendWord(draft: LineDraft, word: VisionWord): boolean {
  draft.bounds = mergeBounds(draft.bounds, getWordBounds(word))
  return (word.symbols ?? []).map((symbol) => appendSymbol(draft, symbol)).some(Boolean)
}

/**
 * Google Vision DOCUMENT_TEXT_DETECTION의 fullTextAnnotation을 받아
 * 단어와 detectedBreak로 줄을 묶고, 페이지 비율 박스를 가진 줄 목록을 반환한다.
 */
export function groupVisionWordsIntoLines(annotation: VisionTextAnnotation | undefined): OcrLine[] {
  const page = annotation?.pages?.[0]
  if (!page?.width || !page.height) return []
  const pageWidth = page.width
  const pageHeight = page.height

  return collectPageLineDrafts(page)
    .map((draft) => ({ bounds: draft.bounds, text: draft.text.trim() }))
    .filter((draft): draft is { bounds: PixelBounds; text: string } =>
      Boolean(draft.text && draft.bounds),
    )
    .map((draft, index) => ({
      box: normalizeBounds(draft.bounds, pageWidth, pageHeight),
      id: `line-${index}`,
      text: draft.text,
    }))
}
