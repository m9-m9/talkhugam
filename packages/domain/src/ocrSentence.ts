import type { OcrLine } from './ocrLayout'
import { getOcrLineSeparator, joinOcrLines } from './ocrQuote'
import { getSelectedLineTexts } from './ocrLineSelection'

export type OcrSentence = { id: string; lineIds: string[]; text: string }

type LineRange = { end: number; lineId: string; start: number }

type TextRange = { end: number; start: number }

type ReadingText = { ranges: LineRange[]; text: string }

/** 문장 끝: 마침표·물음표·느낌표·말줄임표 뒤에 닫는 따옴표·괄호가 붙을 수 있고, 그 뒤가 공백이거나 글 끝이다. */
const sentenceEndPattern = /[.?!…]+["'”’」』)\]]*(?=\s|$)/gu

/** 줄 안 연속 공백을 하나로 줄이고 앞뒤 공백을 지운다. */
function normalizeLineText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** 줄을 한국어 줄바꿈 규칙으로 이어 한 덩어리 글로 만들고, 각 줄이 글에서 차지하는 위치를 함께 반환한다. */
function buildReadingText(lines: readonly OcrLine[]): ReadingText {
  const ranges: LineRange[] = []
  let text = ''
  for (const line of lines) {
    const lineText = normalizeLineText(line.text)
    if (!lineText) continue
    if (text) text += getOcrLineSeparator(text, lineText)
    ranges.push({ end: text.length + lineText.length, lineId: line.id, start: text.length })
    text += lineText
  }
  return { ranges, text }
}

/** 구간 시작에서 공백을 건너뛴 위치를 반환한다. 구간이 모두 공백이면 끝 위치를 반환한다. */
function skipLeadingSpaces(text: string, start: number, end: number): number {
  const offset = text.slice(start, end).search(/\S/)
  return offset < 0 ? end : start + offset
}

/** 글을 문장 끝마다 잘라 앞뒤 공백을 뺀 문장 위치 목록을 반환한다. 마지막 문장 부호 뒤 남은 글도 한 문장으로 둔다. */
function findSentenceRanges(text: string): TextRange[] {
  const ends = [...text.matchAll(sentenceEndPattern)].map((match) => (match.index ?? 0) + match[0].length)
  if (ends.at(-1) !== text.length) ends.push(text.length)
  return ends
    .map((end, index) => ({ end, start: index === 0 ? 0 : (ends[index - 1] ?? 0) }))
    .map(({ end, start }) => ({ end, start: skipLeadingSpaces(text, start, end) }))
    .filter(({ end, start }) => end > start)
}

/** 두 위치 구간이 겹치는지 판단한다. */
function isOverlapping(first: TextRange, second: TextRange): boolean {
  return first.start < second.end && second.start < first.end
}

/**
 * 인식한 줄(위→아래)을 한국어 줄바꿈 규칙으로 이어 붙인 뒤 문장(. ? ! … 뒤, 닫는 따옴표 허용)으로 나눈다.
 * 각 문장은 걸친 줄 ID를 함께 가져, 문장을 고르면 사진 위 줄도 같이 표시할 수 있다.
 */
export function splitOcrSentences(lines: readonly OcrLine[]): OcrSentence[] {
  const { ranges, text } = buildReadingText(lines)
  return findSentenceRanges(text).map((range, index) => ({
    id: `sentence-${index}`,
    lineIds: ranges.filter((lineRange) => isOverlapping(lineRange, range)).map((lineRange) => lineRange.lineId),
    text: text.slice(range.start, range.end),
  }))
}

/** 고른 줄이 위→아래로 이어진 한 묶음이면 글에서 차지하는 구간을, 아니면 null을 반환한다. */
function getContiguousSelectionRange(ranges: LineRange[], selectedIds: readonly string[]): TextRange | null {
  const indexes = ranges.flatMap((range, index) => (selectedIds.includes(range.lineId) ? [index] : []))
  const first = indexes[0]
  const last = indexes.at(-1)
  if (first === undefined || last === undefined || last - first + 1 !== indexes.length) return null
  const start = ranges[first]?.start ?? 0
  return { end: ranges[last]?.end ?? start, start }
}

/**
 * 사진 위에서 고른 줄의 앞뒤에 걸친 잘린 문장 조각을 버리고, 고른 줄 안에 온전히 들어온 문장만 이은
 * 문장 경계에 맞춘 인용을 반환한다. 떨어진 줄을 골랐거나 온전한 문장이 없으면 null을 반환한다.
 */
export function alignSelectionToSentences(lines: readonly OcrLine[], selectedIds: readonly string[]): string | null {
  const { ranges, text } = buildReadingText(lines)
  const selection = getContiguousSelectionRange(ranges, selectedIds)
  if (!selection) return null
  const inside = findSentenceRanges(text).filter(
    (range) => range.start >= selection.start && range.end <= selection.end,
  )
  const first = inside[0]
  const last = inside.at(-1)
  return first && last ? text.slice(first.start, last.end) : null
}

export type QuoteDrafts = { alignedQuote: string | null; rawQuote: string }

/**
 * 사진 위에서 고른 줄로 확인 화면에 보여 줄 두 가지 인용을 만든다. alignedQuote는 문장 경계에 맞춘 기본값이고
 * (고른 줄 그대로와 같거나 만들 수 없으면 null), rawQuote는 고른 줄을 그대로 이은 문장이다.
 */
export function getQuoteDrafts(
  lines: readonly OcrLine[],
  selectedIds: readonly string[],
  { shouldKeepLineBreaks = false }: { shouldKeepLineBreaks?: boolean } = {},
): QuoteDrafts {
  const texts = getSelectedLineTexts(lines, selectedIds)
  const rawQuote = joinOcrLines(texts, { shouldKeepLineBreaks })
  const aligned = alignSelectionToSentences(lines, selectedIds)
  return { alignedQuote: aligned && aligned !== joinOcrLines(texts) ? aligned : null, rawQuote }
}
