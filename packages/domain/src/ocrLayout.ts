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

/** 두 단어를 같은 줄로 볼 최소 세로 겹침 비율(작은 쪽 높이 대비). */
export const OCR_LINE_MIN_VERTICAL_OVERLAP = 0.5

/** 같은 높이라도 이 배수(글자 높이 대비)보다 가로 간격이 크면 다른 줄·다른 페이지로 나눈다. */
export const OCR_LINE_MAX_GAP_HEIGHT_RATIO = 3

type OcrWord = { bounds: PixelBounds; text: string }

type LineGroup = { words: OcrWord[] }

type ColumnGroup = { lines: LineGroup[]; maxX: number; minX: number }

/** 사각형의 세로 높이를 반환한다. 높이가 0이면 나눗셈을 위해 1로 본다. */
function getHeight(bounds: PixelBounds): number {
  return Math.max(1, bounds.maxY - bounds.minY)
}

/** 두 사각형의 세로 겹침 길이를 작은 쪽 높이로 나눈 비율을 반환한다. */
function getVerticalOverlapRatio(a: PixelBounds, b: PixelBounds): number {
  const overlap = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY)
  return overlap / Math.min(getHeight(a), getHeight(b))
}

/** 숫자 목록의 중앙값을 반환한다. 빈 목록이면 1을 반환한다. */
function getMedian(values: number[]): number {
  const sorted = [...values].sort((first, second) => first - second)
  return sorted[Math.floor(sorted.length / 2)] ?? 1
}

/** CLOVA 필드를 글자와 좌표가 모두 있는 단어로 바꾼다. 둘 중 하나라도 없으면 null을 반환한다. */
function toOcrWord(field: ClovaField): OcrWord | null {
  const text = (field.inferText ?? '').replace(/\s+/g, ' ').trim()
  const bounds = getFieldBounds(field)
  return text && bounds ? { bounds, text } : null
}

/** 줄의 마지막(가장 오른쪽) 단어를 반환한다. */
function getLastWord(line: LineGroup): OcrWord | undefined {
  return line.words[line.words.length - 1]
}

/**
 * 새 단어가 줄의 마지막 단어 뒤에 이어질 수 있는지 점수로 반환한다. 세로 겹침이 부족하거나
 * 가로 간격이 글자 높이의 임계 배수보다 크면 null을 반환한다. 마지막 단어 기준이라 기운 줄·곡면에 견딘다.
 */
function scoreLineContinuation(line: LineGroup, word: OcrWord): number | null {
  const last = getLastWord(line)
  if (!last) return null
  const overlap = getVerticalOverlapRatio(last.bounds, word.bounds)
  const gap = word.bounds.minX - last.bounds.maxX
  const maxGap = OCR_LINE_MAX_GAP_HEIGHT_RATIO * Math.max(getHeight(last.bounds), getHeight(word.bounds))
  if (overlap < OCR_LINE_MIN_VERTICAL_OVERLAP || gap > maxGap) return null
  return overlap
}

/** 단어를 이어 붙일 가장 잘 맞는 줄을 찾고, 없으면 null을 반환한다. */
function findBestLine(lines: LineGroup[], word: OcrWord): LineGroup | null {
  let best: { line: LineGroup; score: number } | null = null
  for (const line of lines) {
    const score = scoreLineContinuation(line, word)
    if (score !== null && (best === null || score > best.score)) best = { line, score }
  }
  return best?.line ?? null
}

/** 단어를 왼쪽부터 훑으며 세로로 겹치는 줄의 마지막 단어에 이어 붙여 줄 묶음을 만든다. */
function groupWordsIntoLines(words: OcrWord[]): LineGroup[] {
  const lines: LineGroup[] = []
  const sortedWords = [...words].sort((first, second) => first.bounds.minX - second.bounds.minX)
  for (const word of sortedWords) {
    const line = findBestLine(lines, word)
    if (line) line.words.push(word)
    else lines.push({ words: [word] })
  }
  return lines
}

/** 줄 안 단어를 모두 덮는 픽셀 경계를 반환한다. */
function getLineBounds(line: LineGroup): PixelBounds {
  return line.words.reduce<PixelBounds | null>(
    (bounds, word) => mergeBounds(bounds, word.bounds),
    null,
  ) ?? { maxX: 0, maxY: 0, minX: 0, minY: 0 }
}

/** 줄의 세로 중심을 반환한다. */
function getLineCenterY(line: LineGroup): number {
  const bounds = getLineBounds(line)
  return (bounds.minY + bounds.maxY) / 2
}

/**
 * 줄의 가로 범위를 겹치거나 간격이 좁은 것끼리 열(페이지)로 묶는다. 간격이 제본선처럼
 * `columnGap`보다 넓을 때만 다른 열로 나눈다. 열은 왼쪽부터 정렬된다.
 */
function groupLinesIntoColumns(lines: LineGroup[], columnGap: number): ColumnGroup[] {
  const columns: ColumnGroup[] = []
  const sortedLines = [...lines].sort(
    (first, second) => getLineBounds(first).minX - getLineBounds(second).minX,
  )
  for (const line of sortedLines) {
    const bounds = getLineBounds(line)
    const column = columns[columns.length - 1]
    if (column && bounds.minX - column.maxX <= columnGap) {
      column.lines.push(line)
      column.maxX = Math.max(column.maxX, bounds.maxX)
      continue
    }
    columns.push({ lines: [line], maxX: bounds.maxX, minX: bounds.minX })
  }
  return columns
}

/** 단어 목록을 줄로 묶고, 열(왼쪽 페이지 → 오른쪽 페이지) 단위로 위→아래 읽기 순서로 정렬해 반환한다. */
function orderLinesForReading(words: OcrWord[]): LineGroup[] {
  const lines = groupWordsIntoLines(words)
  const columnGap = OCR_LINE_MAX_GAP_HEIGHT_RATIO * getMedian(words.map((word) => getHeight(word.bounds)))
  return groupLinesIntoColumns(lines, columnGap).flatMap((column) =>
    [...column.lines].sort((first, second) => getLineCenterY(first) - getLineCenterY(second)),
  )
}

/**
 * CLOVA OCR General V2의 `fields`와 인식한 이미지의 픽셀 크기를 받아,
 * `lineBreak`와 응답 순서에 기대지 않고 좌표(세로 겹침·가로 간격)로 줄을 묶은 뒤
 * 열 단위 위→아래 순서와 페이지 비율 박스를 가진 줄 목록을 반환한다.
 */
export function groupClovaFieldsIntoLines(
  fields: ClovaField[] | undefined,
  pageSize: OcrPageSize | null,
): OcrLine[] {
  if (!fields?.length || !pageSize?.width || !pageSize.height) return []
  const { height: pageHeight, width: pageWidth } = pageSize
  const words = fields.map(toOcrWord).filter((word): word is OcrWord => word !== null)

  return orderLinesForReading(words).map((line, index) => ({
    box: normalizeBounds(getLineBounds(line), pageWidth, pageHeight),
    id: `line-${index}`,
    text: line.words.map((word) => word.text).join(' '),
  }))
}
