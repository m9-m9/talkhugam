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

/** 앞 줄 끝이 이 글자(문장부호·닫는 따옴표·괄호)면 다음 줄과 띄운다. */
const lineEndSpacingPattern = /[.,!?…·:;」』"'”’)\]]$/u

/** 다음 줄이 이 글자(여는 따옴표·괄호)로 시작하면 띄운다. */
const lineStartSpacingPattern = /^[「『"'“‘(\[]/u

/** 한글 음절 한 글자. */
const hangulSyllablePattern = /^[가-힣]$/u

/**
 * 어절 끝에 자주 오는 조사·어미. 앞 줄 마지막 어절이 2음절 이상이고 이 글자로 끝나면
 * 어절이 끝난 것으로 보고 띄운다. 실측 31곳 중 30곳이 이 규칙과 맞았다.
 */
export const OCR_WORD_ENDING_SYLLABLES: ReadonlySet<string> = new Set(
  '을 를 은 는 에 의 도 과 와 고 서 면 며 냐 다 요 지 까 할 만 네 세 죠'.split(' '),
)

/** 앞 줄의 마지막 어절이 조사·어미로 끝나 어절이 완성됐는지 판단한다. 한 음절 어절은 이어지는 것으로 본다. */
function isCompleteKoreanWord(previous: string): boolean {
  const lastWord = previous.split(' ').at(-1) ?? ''
  const syllables = [...lastWord].filter((char) => hangulSyllablePattern.test(char))
  return syllables.length >= 2 && OCR_WORD_ENDING_SYLLABLES.has(lastWord.at(-1) ?? '')
}

/**
 * 정리된 앞 줄과 다음 줄 사이에 넣을 문자를 고른다. 책은 음절 단위로 줄을 바꾸므로
 * 문장부호·따옴표·영문 경계·완성된 어절이면 공백을, 그 밖에는 붙여 쓴다(빈 문자열).
 */
export function getOcrLineSeparator(previous: string, next: string): string {
  if (lineEndSpacingPattern.test(previous) || lineStartSpacingPattern.test(next)) return ' '
  const isHangulBoundary =
    hangulSyllablePattern.test(previous.at(-1) ?? '') && hangulSyllablePattern.test(next.at(0) ?? '')
  if (!isHangulBoundary) return ' '
  return isCompleteKoreanWord(previous) ? ' ' : ''
}

/** 정리된 두 줄을 하이픈 규칙·한국어 줄바꿈 규칙과 줄바꿈 옵션에 맞춰 하나로 잇는다. */
function appendLine(joined: string, next: string, shouldKeepLineBreaks: boolean): string {
  if (!joined) return next
  if (isWrappedEnglishWord(joined, next)) return `${joined.slice(0, -1)}${next}`
  if (shouldKeepLineBreaks) return `${joined}\n${next}`
  return `${joined}${getOcrLineSeparator(joined, next)}${next}`
}

/**
 * 사용자가 고른 OCR 줄 텍스트 목록을 받아 하이픈 줄바꿈 병합, 공백 정리,
 * 한국어 음절 줄바꿈 규칙(조사·어미·문장부호로 띄움 여부 판단)을 적용한 하나의 문단 문자열로 반환한다.
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
