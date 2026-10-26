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

  it.each([
    [['나는 오늘 아침에', '책을 읽었다.'], '나는 오늘 아침에 책을 읽었다.'],
    [['사람들은', '모두 웃었다'], '사람들은 모두 웃었다'],
    [['도서관에서 빌린 책', '을 펼쳤다'], '도서관에서 빌린 책을 펼쳤다'],
    [['사람들', '은 모두 웃었다'], '사람들은 모두 웃었다'],
    [['마음이 따뜻해', '졌다'], '마음이 따뜻해졌다'],
    [['한참을 걸었', '다'], '한참을 걸었다'],
  ])('한국어 음절 줄바꿈은 앞 어절 끝 조사·어미를 보고 띄우거나 붙인다 (%j)', (lines, expected) => {
    expect(joinOcrLines(lines)).toBe(expected)
  })

  it('앞 줄이 문장부호·닫는 따옴표로 끝나거나 다음 줄이 여는 따옴표·괄호로 시작하면 띄운다', () => {
    expect(joinOcrLines(['그가 말했다.', '나도 그렇다'])).toBe('그가 말했다. 나도 그렇다')
    expect(joinOcrLines(['「정말이야」', '그가 웃었다'])).toBe('「정말이야」 그가 웃었다')
    expect(joinOcrLines(['그가 물었', '「왜?」'])).toBe('그가 물었 「왜?」')
    expect(joinOcrLines(['조금 쉬었', '(잠깐)'])).toBe('조금 쉬었 (잠깐)')
  })

  it('영문이나 숫자로 끝나거나 시작하는 줄은 기존처럼 띄운다', () => {
    expect(joinOcrLines(['hello', 'world'])).toBe('hello world')
    expect(joinOcrLines(['책 이름은', 'Demian이다'])).toBe('책 이름은 Demian이다')
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
