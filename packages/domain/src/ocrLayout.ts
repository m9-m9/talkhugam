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
  return {
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
    minX: Math.min(...xs),
    minY: Math.min(...ys),
  }
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

/** 본문 왼쪽·오른쪽 선을 추정할 때 쓰는 "넓은 줄"의 최소 폭(페이지 폭 대비). */
export const OCR_WIDE_LINE_MIN_WIDTH_RATIO = 0.35

/** 본문 선을 추정하기 위해 필요한 넓은 줄의 최소 개수. 이보다 적으면 거르지 않고 그대로 돌려준다. */
export const OCR_MIN_WIDE_LINES_FOR_MARGINS = 3

/** 본문 선 바깥으로 볼 여유 폭(페이지 폭 대비). 이보다 더 바깥에서 시작한 필드는 지운다. */
export const OCR_MARGIN_TOLERANCE_RATIO = 0.02

/** 직선 적합 뒤 잔차 하위 이 비율까지만 남겨 한 번 다시 적합한다(들여쓰기·화자 표시 같은 이상치 제거). */
export const OCR_MARGIN_FIT_KEEP_QUANTILE = 0.8

/** 위·아래 끝 줄이 이웃 줄과 보통 줄 간격의 이 배수보다 멀리 떨어져 있으면 본문 밖(머리글·장 제목)으로 본다. */
export const OCR_DETACHED_EDGE_GAP_RATIO = 1.5

/** 숫자·점·가운뎃점·말줄임표만 남은 줄(쪽 번호 등)을 가려내는 패턴. */
const pageNumberPattern = /^[\d.…·\s]+$/

type OcrWord = { bounds: PixelBounds; text: string }

type LineDraft = { words: OcrWord[] }

type MarginLine = (y: number) => number

type FitPoint = { x: number; y: number }

/** CLOVA 필드를 글자와 좌표가 모두 있는 단어로 바꾼다. 둘 중 하나라도 없으면 null을 반환한다. */
function toOcrWord(field: ClovaField): OcrWord | null {
  const text = (field.inferText ?? '').replace(/\s+/g, ' ').trim()
  const bounds = getFieldBounds(field)
  return text && bounds ? { bounds, text } : null
}

/** CLOVA가 준 읽기 순서와 `lineBreak`로 줄 초안을 만든다. 각 단어의 좌표는 그대로 둔다. */
function collectLineDrafts(fields: ClovaField[]): LineDraft[] {
  const drafts: LineDraft[] = []
  let words: OcrWord[] = []
  for (const [index, field] of fields.entries()) {
    const word = toOcrWord(field)
    if (word) words.push(word)
    if (!field.lineBreak && index < fields.length - 1) continue
    if (words.length > 0) drafts.push({ words })
    words = []
  }
  return drafts
}

/** 단어 사각형의 세로 중심을 반환한다. */
function getCenterY(bounds: PixelBounds): number {
  return (bounds.minY + bounds.maxY) / 2
}

/** 줄 안 단어를 모두 덮는 픽셀 경계를 반환한다. */
function getDraftBounds(draft: LineDraft): PixelBounds {
  return (
    draft.words.reduce<PixelBounds | null>((bounds, word) => mergeBounds(bounds, word.bounds), null) ?? {
      maxX: 0,
      maxY: 0,
      minX: 0,
      minY: 0,
    }
  )
}

/** 줄 첫 단어의 세로 중심을 반환한다. 사진이 기울어도 줄 순서를 안정적으로 정하는 기준이다. */
function getDraftAnchorY(draft: LineDraft): number {
  const first = draft.words[0]
  return first ? getCenterY(first.bounds) : 0
}

/** 점 목록에 y = a + b·x 직선을 최소제곱으로 맞춰 계수를 반환한다. */
function fitLine(points: FitPoint[]): { intercept: number; slope: number } {
  const count = points.length
  const sumX = points.reduce((sum, point) => sum + point.x, 0)
  const sumY = points.reduce((sum, point) => sum + point.y, 0)
  const sumXX = points.reduce((sum, point) => sum + point.x * point.x, 0)
  const sumXY = points.reduce((sum, point) => sum + point.x * point.y, 0)
  const slope = (count * sumXY - sumX * sumY) / (count * sumXX - sumX * sumX || 1)
  return { intercept: (sumY - slope * sumX) / count, slope }
}

/**
 * 점 목록에 직선을 맞춘 뒤 잔차가 큰 상위 점을 한 번 빼고 다시 맞춰, 세로 위치(y)를 받아
 * 본문 선의 x를 돌려주는 함수를 반환한다. 사진 기울기를 반영하고 들여쓰기 같은 이상치에 덜 흔들린다.
 */
function fitRobustMargin(points: FitPoint[]): MarginLine {
  const first = fitLine(points)
  const residuals = points.map((point) => Math.abs(point.y - (first.intercept + first.slope * point.x)))
  const limit = [...residuals].sort((a, b) => a - b)[Math.floor(residuals.length * OCR_MARGIN_FIT_KEEP_QUANTILE)] ?? Infinity
  const second = fitLine(points.filter((_, index) => (residuals[index] ?? 0) <= limit))
  return (y) => second.intercept + second.slope * y
}

/** 넓은 줄로 본문 왼쪽·오른쪽 선을 추정한다. 넓은 줄이 부족하면 null을 반환한다. */
function estimateBodyMargins(drafts: LineDraft[], pageWidth: number): { left: MarginLine; right: MarginLine } | null {
  const wideBounds = drafts
    .map((draft) => ({ anchorY: getDraftAnchorY(draft), bounds: getDraftBounds(draft) }))
    .filter(({ bounds }) => bounds.maxX - bounds.minX >= OCR_WIDE_LINE_MIN_WIDTH_RATIO * pageWidth)
  if (wideBounds.length < OCR_MIN_WIDE_LINES_FOR_MARGINS) return null
  return {
    left: fitRobustMargin(wideBounds.map(({ anchorY, bounds }) => ({ x: anchorY, y: bounds.minX }))),
    right: fitRobustMargin(wideBounds.map(({ anchorY, bounds }) => ({ x: anchorY, y: bounds.maxX }))),
  }
}

/** 단어가 그 높이에서 본문 왼쪽·오른쪽 선(여유 폭 포함) 안에서 시작하는지 판단한다. */
function isInsideBody(word: OcrWord, margins: { left: MarginLine; right: MarginLine }, tolerance: number): boolean {
  const y = getCenterY(word.bounds)
  return word.bounds.minX >= margins.left(y) - tolerance && word.bounds.minX < margins.right(y) + tolerance
}

/** 줄 초안이 쪽 번호처럼 숫자·점만으로 이루어졌는지 판단한다. */
function isPageNumberDraft(draft: LineDraft): boolean {
  return pageNumberPattern.test(draft.words.map((word) => word.text).join(' '))
}

/** 위→아래로 정렬한 줄들의 보통 줄 간격(이웃 줄 첫 단어 세로 중심 차의 중앙값)을 반환한다. */
function getMedianLinePitch(drafts: LineDraft[]): number {
  const gaps = drafts.slice(1).map((draft, index) => getDraftAnchorY(draft) - getDraftAnchorY(drafts[index] as LineDraft))
  return [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)] ?? 0
}

/** 끝 줄이 넓은 본문 줄이 아니고, 이웃 줄과 보통 줄 간격보다 크게 떨어져 있는지 판단한다. */
function isDetachedEdgeLine(edge: LineDraft, neighbor: LineDraft | undefined, pitch: number, pageWidth: number): boolean {
  if (!neighbor || pitch <= 0) return false
  const bounds = getDraftBounds(edge)
  const isWide = bounds.maxX - bounds.minX >= OCR_WIDE_LINE_MIN_WIDTH_RATIO * pageWidth
  const gap = Math.abs(getDraftAnchorY(neighbor) - getDraftAnchorY(edge))
  return !isWide && gap > OCR_DETACHED_EDGE_GAP_RATIO * pitch
}

/** 위·아래 끝에서 본문과 떨어진 좁은 줄(머리글·장 제목·꼬리글)을 차례로 지운다. 정렬된 줄을 받는다. */
function trimDetachedEdgeLines(drafts: LineDraft[], pageWidth: number): LineDraft[] {
  const pitch = getMedianLinePitch(drafts)
  let start = 0
  let end = drafts.length
  while (end - start > 1 && isDetachedEdgeLine(drafts[start] as LineDraft, drafts[start + 1], pitch, pageWidth)) start += 1
  while (end - start > 1 && isDetachedEdgeLine(drafts[end - 1] as LineDraft, drafts[end - 2], pitch, pageWidth)) end -= 1
  return drafts.slice(start, end)
}

/**
 * 본문 선 바깥 단어(잘린 앞 페이지 조각·화자 표시)를 지우고, 비었거나 쪽 번호만 남은 줄을 빼서
 * 줄 첫 단어의 세로 중심 순으로 정렬한 뒤, 위·아래에서 본문과 떨어진 머리글·장 제목 줄을 지운다.
 * 본문 선을 추정할 수 없으면 줄 초안을 그대로 돌려준다.
 */
function keepBodyLines(drafts: LineDraft[], pageWidth: number): LineDraft[] {
  const margins = estimateBodyMargins(drafts, pageWidth)
  if (!margins) return drafts
  const tolerance = OCR_MARGIN_TOLERANCE_RATIO * pageWidth
  const bodyDrafts = drafts
    .map((draft) => ({ words: draft.words.filter((word) => isInsideBody(word, margins, tolerance)) }))
    .filter((draft) => draft.words.length > 0 && !isPageNumberDraft(draft))
    .sort((first, second) => getDraftAnchorY(first) - getDraftAnchorY(second))
  return trimDetachedEdgeLines(bodyDrafts, pageWidth)
}

/**
 * CLOVA OCR General V2의 `fields`와 인식한 이미지의 픽셀 크기를 받아 줄 목록을 반환한다.
 * 줄은 CLOVA 순서와 `lineBreak`(기운 줄에서도 정확)로 나누고, 넓은 줄로 기울기를 반영한 본문 선을
 * 추정해 선 바깥 조각·화자 표시와 쪽 번호를 지운 뒤 위→아래로 정렬하고, 본문과 떨어진 머리글·장 제목을 지운다.
 * 박스는 남은 단어로만 계산한다.
 */
export function groupClovaFieldsIntoLines(
  fields: ClovaField[] | undefined,
  pageSize: OcrPageSize | null,
): OcrLine[] {
  if (!fields?.length || !pageSize?.width || !pageSize.height) return []
  const { height: pageHeight, width: pageWidth } = pageSize

  return keepBodyLines(collectLineDrafts(fields), pageWidth).map((draft, index) => ({
    box: normalizeBounds(getDraftBounds(draft), pageWidth, pageHeight),
    id: `line-${index}`,
    text: draft.words.map((word) => word.text).join(' '),
  }))
}
