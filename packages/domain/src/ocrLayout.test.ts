import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { type ClovaField, groupClovaFieldsIntoLines } from './ocrLayout'

const pageSize = { height: 1000, width: 500 }

type ClovaFixture = {
  images: Array<{ convertedImageInfo: { height: number; width: number }; fields: ClovaField[] }>
}

/** 글자를 가짜 한글로 바꾼 실제 CLOVA 좌표 픽스처를 읽는다. */
function readFixture(name: 'a' | 'b') {
  const url = new URL(`./__fixtures__/clova-fixture-page-${name}.json`, import.meta.url)
  const fixture = JSON.parse(readFileSync(url, 'utf8')) as ClovaFixture
  const image = fixture.images[0]
  if (!image) throw new Error('fixture image missing')
  return { fields: image.fields, size: image.convertedImageInfo }
}

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

/** 본문 왼쪽 x=100, 오른쪽 x=900 사이를 채우는 넓은 줄 하나를 두 필드로 만든다. */
function createBodyLine(text: string, y: number, left = 100): ClovaField[] {
  return [
    createField(`${text}앞`, { height: 30, width: 380, x: left, y }),
    createField(`${text}뒤`, { height: 30, width: 380, x: left + 420, y }, true),
  ]
}

describe('groupClovaFieldsIntoLines — 실제 좌표 픽스처', () => {
  it.each(['a', 'b'] as const)('page-%s 본문 24줄만 위→아래로 남긴다', (name) => {
    const { fields, size } = readFixture(name)
    const lines = groupClovaFieldsIntoLines(fields, size)

    expect(lines).toHaveLength(24)
    const ys = lines.map((line) => line.box.y + line.box.height / 2)
    expect(ys).toEqual([...ys].sort((first, second) => first - second))
    expect(lines.some((line) => line.box.x < 0.05)).toBe(false)
    expect(lines.some((line) => /^[\d.…·\s]+$/.test(line.text))).toBe(false)
    expect(lines.some((line) => /\b(115|127)\b/.test(line.text))).toBe(false)
  })

  it('잘린 앞 페이지 조각(x≈0, 좁은 폭)과 본문 왼쪽 선 바깥의 화자 표시를 지운다', () => {
    const { fields, size } = readFixture('a')
    const lines = groupClovaFieldsIntoLines(fields, size)
    const keptText = lines.map((line) => line.text).join(' ')
    const outsideTexts = fields
      .filter((field) => (field.boundingPoly?.vertices?.[0]?.x ?? 0) < 0.11 * size.width)
      .map((field) => field.inferText ?? '')

    expect(outsideTexts.length).toBeGreaterThan(0)
    for (const text of outsideTexts) expect(keptText.split(' ')).not.toContain(text)
  })
})

describe('groupClovaFieldsIntoLines', () => {
  it('CLOVA 순서와 lineBreak로 줄을 나누고 필드를 공백으로 잇는다', () => {
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

  it('한 줄 안 높이 차가 줄 간격보다 크게 기울어도 lineBreak대로 줄을 지킨다', () => {
    const page = { height: 2000, width: 1000 }
    const tilted = [0, 1, 2, 3].flatMap((index) => [
      createField(`줄${index}가`, { height: 30, width: 380, x: 100, y: 300 + index * 70 }),
      createField(`줄${index}나`, { height: 30, width: 380, x: 520, y: 390 + index * 70 }, true),
    ])

    const lines = groupClovaFieldsIntoLines(tilted, page)

    expect(lines.map((line) => line.text)).toEqual(['줄0가 줄0나', '줄1가 줄1나', '줄2가 줄2나', '줄3가 줄3나'])
  })

  it('본문 선 바깥 필드·쪽 번호 줄을 지우고 줄 박스는 남은 필드로만 계산한다', () => {
    const page = { height: 2000, width: 1000 }
    const lines = groupClovaFieldsIntoLines(
      [
        createField('조각', { height: 30, width: 50, x: 0, y: 300 }, true),
        ...createBodyLine('첫', 300),
        createField('화자', { height: 30, width: 50, x: 20, y: 350 }),
        ...createBodyLine('둘', 350),
        ...createBodyLine('셋', 400),
        createField('115', { height: 30, width: 60, x: 480, y: 1900 }, true),
      ],
      page,
    )

    expect(lines.map((line) => line.text)).toEqual(['첫앞 첫뒤', '둘앞 둘뒤', '셋앞 셋뒤'])
    expect(lines[1]?.box).toEqual({ height: 0.015, width: 0.8, x: 0.1, y: 0.175 })
  })

  it('본문과 줄 간격보다 크게 떨어진 위쪽 좁은 머리글·장 제목 줄을 지운다', () => {
    const page = { height: 2000, width: 1000 }
    const lines = groupClovaFieldsIntoLines(
      [
        createField('머리글', { height: 20, width: 200, x: 400, y: 100 }, true),
        ...createBodyLine('첫', 300),
        ...createBodyLine('둘', 350),
        createField('짧은 끝줄', { height: 30, width: 200, x: 100, y: 400 }, true),
        ...createBodyLine('넷', 450),
      ],
      page,
    )

    expect(lines.map((line) => line.text)).toEqual(['첫앞 첫뒤', '둘앞 둘뒤', '짧은 끝줄', '넷앞 넷뒤'])
  })

  it('줄 첫 필드의 세로 중심으로 위→아래 정렬한다', () => {
    const page = { height: 2000, width: 1000 }
    const lines = groupClovaFieldsIntoLines(
      [...createBodyLine('셋', 400), ...createBodyLine('첫', 300), ...createBodyLine('둘', 350)],
      page,
    )

    expect(lines.map((line) => line.text)).toEqual(['첫앞 첫뒤', '둘앞 둘뒤', '셋앞 셋뒤'])
  })

  it('넓은 줄이 3개 미만이면 본문 선을 추정하지 않고 lineBreak 줄을 그대로 돌려준다', () => {
    const lines = groupClovaFieldsIntoLines(
      [
        createField('제1장', { height: 30, width: 90, x: 0, y: 50 }, true),
        createField('7', { height: 20, width: 20, x: 200, y: 900 }, true),
      ],
      pageSize,
    )

    expect(lines.map((line) => line.text)).toEqual(['제1장', '7'])
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

  it('빈 글자나 좌표 없는 필드는 버리고, 남은 필드가 없는 줄은 만들지 않는다', () => {
    const lines = groupClovaFieldsIntoLines(
      [
        { inferText: '좌표없음', lineBreak: true },
        createField(' ', { height: 10, width: 10, x: 0, y: 0 }, true),
        createField('', { height: 20, width: 10, x: 110, y: 100 }),
        createField('남은', { height: 20, width: 40, x: 50, y: 100 }, true),
      ],
      pageSize,
    )

    expect(lines.map((line) => line.text)).toEqual(['남은'])
  })

  it('필드나 페이지 크기가 없으면 빈 배열을 반환한다', () => {
    const field = createField('가', { height: 1, width: 1, x: 0, y: 0 })

    expect(groupClovaFieldsIntoLines([], pageSize)).toEqual([])
    expect(groupClovaFieldsIntoLines(undefined, pageSize)).toEqual([])
    expect(groupClovaFieldsIntoLines([field], null)).toEqual([])
  })
})
