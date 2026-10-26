import type { OcrLine } from './ocrLayout'
import { joinOcrLines, ocrQuoteMaxLength } from './ocrQuote'

export type LineRangeMode = 'add' | 'remove'

/** 선택한 줄 ID 목록과 탭한 줄 ID를 받아 그 줄을 켜거나 끈 새 목록을 반환한다. */
export function toggleLineId(selectedIds: readonly string[], lineId: string): string[] {
  if (selectedIds.includes(lineId)) return selectedIds.filter((id) => id !== lineId)
  return [...selectedIds, lineId]
}

/** 끌기 시작 줄과 현재 줄 사이(양 끝 포함)의 줄 ID를 사진 속 순서대로 반환한다. */
export function getLineRangeIds(
  lines: readonly OcrLine[],
  startId: string,
  endId: string,
): string[] {
  const startIndex = lines.findIndex((line) => line.id === startId)
  const endIndex = lines.findIndex((line) => line.id === endId)
  if (startIndex < 0 || endIndex < 0) return []
  const [from, to] = startIndex <= endIndex ? [startIndex, endIndex] : [endIndex, startIndex]
  return lines.slice(from, to + 1).map((line) => line.id)
}

/** 끌기 시작 전 선택 목록에 끌기 범위를 더하거나 빼서 새 선택 목록을 반환한다. */
export function applyLineRange(
  baseIds: readonly string[],
  rangeIds: readonly string[],
  mode: LineRangeMode,
): string[] {
  if (mode === 'remove') return baseIds.filter((id) => !rangeIds.includes(id))
  return [...baseIds, ...rangeIds.filter((id) => !baseIds.includes(id))]
}

/** 선택한 줄 ID를 사진 속 줄 순서대로 정렬해 텍스트 목록으로 반환한다. */
export function getSelectedLineTexts(
  lines: readonly OcrLine[],
  selectedIds: readonly string[],
): string[] {
  return lines.filter((line) => selectedIds.includes(line.id)).map((line) => line.text)
}

/** 사진 기준 0~1 비율 좌표를 받아 그 위치를 덮는 줄을 찾고, 없으면 null을 반환한다. */
export function findLineAtPoint(
  lines: readonly OcrLine[],
  xRatio: number,
  yRatio: number,
): OcrLine | null {
  return (
    lines.find(
      ({ box }) =>
        xRatio >= box.x &&
        xRatio <= box.x + box.width &&
        yRatio >= box.y &&
        yRatio <= box.y + box.height,
    ) ?? null
  )
}

export type LineSelectionSummary = {
  isOverLimit: boolean
  lineCount: number
  quoteLength: number
  texts: string[]
}

/** 인식한 줄과 선택한 줄 ID를 받아 선택 요약(줄 수, 정리한 문장 길이, 300자 초과 여부, 텍스트)을 반환한다. */
export function getLineSelectionSummary(
  lines: readonly OcrLine[],
  selectedIds: readonly string[],
): LineSelectionSummary {
  const texts = getSelectedLineTexts(lines, selectedIds)
  const quoteLength = joinOcrLines(texts).length
  return {
    isOverLimit: quoteLength > ocrQuoteMaxLength,
    lineCount: texts.length,
    quoteLength,
    texts,
  }
}
