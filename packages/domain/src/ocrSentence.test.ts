import { describe, expect, it } from 'vitest'

import type { OcrLine } from './ocrLayout'
import { alignSelectionToSentences, getQuoteDrafts, splitOcrSentences } from './ocrSentence'

/** 줄 텍스트 목록을 위→아래 박스를 가진 OCR 줄로 만든다. */
function createLines(texts: string[]): OcrLine[] {
  return texts.map((text, index) => ({
    box: { height: 0.02, width: 0.8, x: 0.1, y: 0.1 + index * 0.03 },
    id: `line-${index}`,
    text,
  }))
}

const lines = createLines([
  '앞 페이지에서 이어진 끝',
  '부분이다. 나는 오늘 아침에',
  '책을 읽었다. 「정말 좋았어?」 그는',
  '물었다. 나는 고개를 끄덕였',
  '다! 다음 페이지로 이어지는',
])

describe('splitOcrSentences', () => {
  it('줄을 한국어 규칙으로 이어 붙인 뒤 문장부호(닫는 따옴표 포함) 뒤에서 문장을 나눈다', () => {
    expect(splitOcrSentences(lines).map((sentence) => sentence.text)).toEqual([
      '앞 페이지에서 이어진 끝부분이다.',
      '나는 오늘 아침에 책을 읽었다.',
      '「정말 좋았어?」',
      '그는 물었다.',
      '나는 고개를 끄덕였다!',
      '다음 페이지로 이어지는',
    ])
  })

  it('문장마다 걸친 줄 ID를 위→아래 순서로 돌려준다', () => {
    const sentences = splitOcrSentences(lines)

    expect(sentences[1]).toEqual({
      id: 'sentence-1',
      lineIds: ['line-1', 'line-2'],
      text: '나는 오늘 아침에 책을 읽었다.',
    })
    expect(sentences[4]?.lineIds).toEqual(['line-3', 'line-4'])
  })

  it('줄이 없으면 빈 목록을 돌려준다', () => {
    expect(splitOcrSentences([])).toEqual([])
  })
})

describe('alignSelectionToSentences', () => {
  it('고른 줄 앞뒤의 잘린 문장 조각을 잘라 문장 경계에 맞춘다', () => {
    expect(alignSelectionToSentences(lines, ['line-1', 'line-2', 'line-3'])).toBe(
      '나는 오늘 아침에 책을 읽었다. 「정말 좋았어?」 그는 물었다.',
    )
  })

  it('고른 줄 안에 온전한 문장이 없으면 null을 돌려준다', () => {
    expect(alignSelectionToSentences(lines, ['line-3'])).toBeNull()
  })

  it('페이지 첫 줄은 문장 시작으로 보고 뒤쪽 잘린 조각만 자른다', () => {
    expect(alignSelectionToSentences(lines, ['line-0', 'line-1'])).toBe(
      '앞 페이지에서 이어진 끝부분이다.',
    )
  })

  it('떨어진 줄을 골랐거나 아무것도 고르지 않았으면 null을 돌려준다', () => {
    expect(alignSelectionToSentences(lines, ['line-0', 'line-2'])).toBeNull()
    expect(alignSelectionToSentences(lines, [])).toBeNull()
  })
})

describe('getQuoteDrafts', () => {
  it('문장 경계에 맞춘 인용과 고른 줄 그대로를 함께 주고, 둘이 같으면 맞춘 인용은 null이다', () => {
    expect(getQuoteDrafts(lines, ['line-1', 'line-2'])).toEqual({
      alignedQuote: '나는 오늘 아침에 책을 읽었다. 「정말 좋았어?」',
      rawQuote: '부분이다. 나는 오늘 아침에 책을 읽었다. 「정말 좋았어?」 그는',
    })
    expect(getQuoteDrafts(createLines(['짧은 문장이다.']), ['line-0'])).toEqual({
      alignedQuote: null,
      rawQuote: '짧은 문장이다.',
    })
  })

  it('원문 줄바꿈 유지를 고르면 고른 줄 그대로만 개행으로 잇는다', () => {
    expect(getQuoteDrafts(lines, ['line-1', 'line-2'], { shouldKeepLineBreaks: true }).rawQuote).toBe(
      '부분이다. 나는 오늘 아침에\n책을 읽었다. 「정말 좋았어?」 그는',
    )
  })
})
