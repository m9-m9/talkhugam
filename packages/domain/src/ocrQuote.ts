import { z } from 'zod'

import type { OcrLine } from './ocrLayout'

/** 사진에서 한 번에 가져올 수 있는 인용 최대 글자 수. 감상을 덧붙일 여유를 위해 본문 500자보다 작게 둔다. */
export const ocrQuoteMaxLength = 300

const ratioSchema = z.number().min(0).max(1)

export const ocrBoxSchema = z.object({
  height: ratioSchema,
  width: ratioSchema,
  x: ratioSchema,
  y: ratioSchema,
})

export const ocrLineSchema = z.object({
  box: ocrBoxSchema,
  id: z.string().min(1).max(40),
  text: z.string().min(1).max(2000),
})

export const ocrPageResponseSchema = z.object({
  data: z.object({ lines: z.array(ocrLineSchema).max(2000) }),
  ok: z.literal(true),
})

type JoinOcrLinesOptions = { shouldKeepLineBreaks?: boolean }

/** 줄 안의 연속 공백을 하나로 줄이고 앞뒤 공백을 지운다. */
function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** 앞 줄이 영문 단어 중간 하이픈으로 끝나고 다음 줄이 영문 소문자로 시작하는지 판단한다. */
function isWrappedEnglishWord(previous: string, next: string): boolean {
  return /[A-Za-z]-$/.test(previous) && /^[a-z]/.test(next)
}

/** 정리된 두 줄을 하이픈 규칙과 줄바꿈 옵션에 맞춰 하나로 잇는다. */
function appendLine(joined: string, next: string, shouldKeepLineBreaks: boolean): string {
  if (!joined) return next
  if (isWrappedEnglishWord(joined, next)) return `${joined.slice(0, -1)}${next}`
  return `${joined}${shouldKeepLineBreaks ? '\n' : ' '}${next}`
}

/**
 * 사용자가 고른 OCR 줄 텍스트 목록을 받아 하이픈 줄바꿈 병합, 공백 정리,
 * 한국어 줄바꿈 공백 처리를 한 하나의 문단 문자열로 반환한다.
 */
export function joinOcrLines(
  lines: readonly string[],
  { shouldKeepLineBreaks = false }: JoinOcrLinesOptions = {},
): string {
  return lines
    .map(collapseWhitespace)
    .filter(Boolean)
    .reduce((joined, next) => appendLine(joined, next, shouldKeepLineBreaks), '')
}

/** 인용 문장이 비어 있지 않고 300자 상한 안에 있는지 판단한다. */
export function isQuoteWithinLimit(quote: string): boolean {
  const trimmed = quote.trim()
  return trimmed.length > 0 && trimmed.length <= ocrQuoteMaxLength
}

/** 현재 입력 초안 끝에 인용 문장을 낫표(「」) 형식으로 붙인 새 초안을 반환한다. */
export function insertQuoteIntoDraft(draft: string, quote: string): string {
  const quoted = `「${quote.trim()}」\n`
  if (!draft.trim()) return quoted
  return `${draft.replace(/\s+$/, '')}\n${quoted}`
}

/** ocr-page Edge Function 응답을 검증해 화면에서 쓸 줄 목록으로 변환한다. */
export function parseOcrPageResponse(value: unknown): OcrLine[] {
  return ocrPageResponseSchema.parse(value).data.lines
}
