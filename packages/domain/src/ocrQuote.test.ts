import { describe, expect, it } from 'vitest'

import {
  insertQuoteIntoDraft,
  isQuoteWithinLimit,
  joinOcrLines,
  ocrQuoteMaxLength,
  parseOcrPageResponse,
} from './ocrQuote'

const box = { height: 0.02, width: 0.5, x: 0.1, y: 0.1 }

describe('joinOcrLines', () => {
  it('한국어 줄바꿈은 공백 하나로 잇는다', () => {
    expect(joinOcrLines(['우리는 늘 떠나는 쪽이었고', '남는 쪽의 마음을 헤아린'])).toBe(
      '우리는 늘 떠나는 쪽이었고 남는 쪽의 마음을 헤아린',
    )
  })

  it('줄 끝 하이픈 뒤 영문 소문자로 이어지면 하이픈을 지우고 붙인다', () => {
    expect(joinOcrLines(['an extra-', 'ordinary day'])).toBe('an extraordinary day')
  })

  it('다음 줄이 대문자나 한글이면 하이픈을 남긴다', () => {
    expect(joinOcrLines(['Jean-', 'Paul'])).toBe('Jean- Paul')
    expect(joinOcrLines(['2020-', '2021년'])).toBe('2020- 2021년')
  })

  it('연속 공백과 앞뒤 공백을 정리하고 빈 줄은 버린다', () => {
    expect(joinOcrLines(['  그 해   여름은 ', '', '   ', '유난히\t길었다  '])).toBe(
      '그 해 여름은 유난히 길었다',
    )
  })

  it('원문 줄바꿈 유지를 고르면 줄마다 개행으로 잇는다', () => {
    expect(joinOcrLines(['첫 줄  입니다', '둘째 줄'], { shouldKeepLineBreaks: true })).toBe(
      '첫 줄 입니다\n둘째 줄',
    )
  })
})

describe('isQuoteWithinLimit', () => {
  it('공백을 뺀 1자 이상, 300자 이하만 허용한다', () => {
    expect(ocrQuoteMaxLength).toBe(300)
    expect(isQuoteWithinLimit('가'.repeat(300))).toBe(true)
    expect(isQuoteWithinLimit('가'.repeat(301))).toBe(false)
    expect(isQuoteWithinLimit('   ')).toBe(false)
  })
})

describe('insertQuoteIntoDraft', () => {
  it('빈 입력창에는 낫표 인용과 개행만 넣는다', () => {
    expect(insertQuoteIntoDraft('', ' 우리는 늘 ')).toBe('「우리는 늘」\n')
  })

  it('기존 입력이 있으면 다음 줄에 인용을 붙인다', () => {
    expect(insertQuoteIntoDraft('이 문장이 좋았다\n', '우리는 늘')).toBe(
      '이 문장이 좋았다\n「우리는 늘」\n',
    )
  })
})

describe('parseOcrPageResponse', () => {
  it('Edge Function 성공 응답에서 줄 목록을 꺼낸다', () => {
    expect(
      parseOcrPageResponse({
        data: { lines: [{ box, id: 'line-0', text: '우리는' }] },
        ok: true,
        requestId: 'request-1',
      }),
    ).toEqual([{ box, id: 'line-0', text: '우리는' }])
  })

  it('비율 범위를 벗어난 박스는 거부한다', () => {
    expect(() =>
      parseOcrPageResponse({
        data: { lines: [{ box: { ...box, x: 1.5 }, id: 'line-0', text: '우리는' }] },
        ok: true,
      }),
    ).toThrow()
  })
})
