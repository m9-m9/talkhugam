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
  it('필드를 공백으로 잇고 lineBreak에서 줄을 나눈다', () => {
    const lines = groupClovaFieldsIntoLines(
      [
        createField('우리는', { height: 20, width: 60, x: 50, y: 100 }),
        createField('늘', { height: 20, width: 20, x: 120, y: 100 }, true),
        createField('떠나는', { height: 20, width: 60, x: 50, y: 130 }, true),
      ],
      pageSize,
    )

    expect(lines.map((line) => line.text)).toEqual(['우리는 늘', '떠나는'])
    expect(lines.map((line) => line.id)).toEqual(['line-0', 'line-1'])
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

  it('마지막 필드에 lineBreak가 없어도 줄을 닫는다', () => {
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

  it('빈 글자나 좌표 없는 줄은 버린다', () => {
    const lines = groupClovaFieldsIntoLines(
      [
        { inferText: '좌표없음', lineBreak: true },
        createField(' ', { height: 10, width: 10, x: 0, y: 0 }, true),
      ],
      pageSize,
    )

    expect(lines).toEqual([])
  })

  it('필드나 페이지 크기가 없으면 빈 배열을 반환한다', () => {
    const field = createField('가', { height: 1, width: 1, x: 0, y: 0 })

    expect(groupClovaFieldsIntoLines([], pageSize)).toEqual([])
    expect(groupClovaFieldsIntoLines(undefined, pageSize)).toEqual([])
    expect(groupClovaFieldsIntoLines([field], null)).toEqual([])
  })
})
