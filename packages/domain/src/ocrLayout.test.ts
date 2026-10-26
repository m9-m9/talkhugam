import { describe, expect, it } from 'vitest'

import { type ClovaField, groupClovaFieldsIntoLines } from './ocrLayout'

const pageSize = { height: 1000, width: 500 }

/** 테스트용 CLOVA 필드를 사각형 좌표와 줄 끝 여부로 만든다. */
function createField(
  inferText: string,
  box: { x: number; y: number; width: number; height: number },
  lineBreak = false,
): ClovaField {
  return {
    boundingPoly: {
      vertices: [
        { x: box.x, y: box.y },
        { x: box.x + box.width, y: box.y },
        { x: box.x + box.width, y: box.y + box.height },
        { x: box.x, y: box.y + box.height },
      ],
    },
    inferText,
    lineBreak,
  }
}

describe('groupClovaFieldsIntoLines', () => {
  it('lineBreak와 응답 순서가 아니라 좌표로 같은 줄을 묶고 줄 안은 x 순서로 잇는다', () => {
    const lines = groupClovaFieldsIntoLines(
      [
        createField('떠나는', { height: 20, width: 60, x: 50, y: 130 }, true),
        createField('늘', { height: 20, width: 20, x: 120, y: 100 }, true),
        createField('쪽이었고', { height: 20, width: 80, x: 120, y: 131 }),
        createField('우리는', { height: 20, width: 60, x: 50, y: 101 }, true),
      ],
      pageSize,
    )

    expect(lines.map((line) => line.text)).toEqual(['우리는 늘', '떠나는 쪽이었고'])
    expect(lines.map((line) => line.id)).toEqual(['line-0', 'line-1'])
  })

  it('조금씩 기울거나 휜 줄도 마지막 단어 기준으로 이어 한 줄로 묶는다', () => {
    const words = ['남는', '쪽의', '마음을', '헤아린', '적이', '없었다.']
    const skewed = words.map((word, index) =>
      createField(word, { height: 20, width: 50, x: 20 + index * 60, y: 200 + index * 6 }),
    )
    const nextLine = words.map((word, index) =>
      createField(`${word}2`, { height: 20, width: 50, x: 20 + index * 60, y: 230 + index * 6 }),
    )

    const lines = groupClovaFieldsIntoLines([...nextLine, ...skewed].reverse(), {
      height: 1000,
      width: 1000,
    })

    expect(lines.map((line) => line.text)).toEqual([
      '남는 쪽의 마음을 헤아린 적이 없었다.',
      '남는2 쪽의2 마음을2 헤아린2 적이2 없었다.2',
    ])
  })

  it('양쪽 페이지 사이처럼 가로 간격이 크면 나누고 왼쪽 페이지 위→아래, 오른쪽 페이지 위→아래로 정렬한다', () => {
    const spread = { height: 1000, width: 1000 }
    const lines = groupClovaFieldsIntoLines(
      [
        createField('오른쪽', { height: 20, width: 80, x: 560, y: 100 }),
        createField('첫줄', { height: 20, width: 60, x: 650, y: 100 }),
        createField('왼쪽', { height: 20, width: 60, x: 40, y: 100 }),
        createField('첫줄', { height: 20, width: 60, x: 110, y: 100 }),
        createField('끝', { height: 20, width: 300, x: 140, y: 100 }),
        createField('오른쪽 둘째', { height: 20, width: 200, x: 560, y: 130 }),
        createField('왼쪽 둘째', { height: 20, width: 200, x: 40, y: 130 }),
      ],
      spread,
    )

    expect(lines.map((line) => line.text)).toEqual([
      '왼쪽 첫줄 끝',
      '왼쪽 둘째',
      '오른쪽 첫줄',
      '오른쪽 둘째',
    ])
  })

  it('한 단어짜리 줄도 따로 남긴다', () => {
    const lines = groupClovaFieldsIntoLines(
      [
        createField('제1장', { height: 30, width: 90, x: 200, y: 50 }),
        createField('긴', { height: 20, width: 40, x: 50, y: 120 }),
        createField('본문', { height: 20, width: 60, x: 100, y: 121 }),
      ],
      pageSize,
    )

    expect(lines.map((line) => line.text)).toEqual(['제1장', '긴 본문'])
  })

  it('줄 박스를 페이지 크기 기준 0~1 비율로 정규화한다', () => {
    const lines = groupClovaFieldsIntoLines(
      [
        createField('우리는', { height: 20, width: 60, x: 50, y: 100 }),
        createField('늘', { height: 20, width: 20, x: 120, y: 100 }, true),
      ],
      pageSize,
    )

    expect(lines[0]?.box).toEqual({ height: 0.02, width: 0.18, x: 0.1, y: 0.1 })
  })

  it('lineBreak가 없어도 줄을 만든다', () => {
    const lines = groupClovaFieldsIntoLines(
      [createField('끝', { height: 10, width: 10, x: 0, y: 0 })],
      pageSize,
    )

    expect(lines.map((line) => line.text)).toEqual(['끝'])
  })

  it('좌표가 없는 꼭짓점은 0으로 보고 범위를 벗어난 값은 0~1로 자른다', () => {
    const lines = groupClovaFieldsIntoLines(
      [
        {
          boundingPoly: { vertices: [{}, { x: 120 }, { x: 120, y: 50 }, { y: 50 }] },
          inferText: '가',
          lineBreak: true,
        },
      ],
      { height: 100, width: 100 },
    )

    expect(lines[0]?.box).toEqual({ height: 0.5, width: 1, x: 0, y: 0 })
  })

  it('빈 글자나 좌표 없는 필드는 버리고 나머지로 줄을 만든다', () => {
    const lines = groupClovaFieldsIntoLines(
      [
        { inferText: '좌표없음', lineBreak: true },
        createField(' ', { height: 10, width: 10, x: 0, y: 0 }, true),
        createField('', { height: 20, width: 10, x: 110, y: 100 }),
        createField('남은', { height: 20, width: 40, x: 50, y: 100 }),
      ],
      pageSize,
    )

    expect(lines.map((line) => line.text)).toEqual(['남은'])
    expect(groupClovaFieldsIntoLines([{ inferText: '좌표없음' }], pageSize)).toEqual([])
  })

  it('필드나 페이지 크기가 없으면 빈 배열을 반환한다', () => {
    const field = createField('가', { height: 1, width: 1, x: 0, y: 0 })

    expect(groupClovaFieldsIntoLines([], pageSize)).toEqual([])
    expect(groupClovaFieldsIntoLines(undefined, pageSize)).toEqual([])
    expect(groupClovaFieldsIntoLines([field], null)).toEqual([])
  })
})
