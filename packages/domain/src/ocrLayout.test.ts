import { describe, expect, it } from 'vitest'

import { groupVisionWordsIntoLines, type VisionTextAnnotation } from './ocrLayout'

/** 테스트용 단어를 글자별 break와 사각형 좌표로 만든다. */
function createWord(
  text: string,
  box: { x: number; y: number; width: number; height: number },
  lastBreak?: string,
) {
  const characters = Array.from(text)
  return {
    boundingBox: {
      vertices: [
        { x: box.x, y: box.y },
        { x: box.x + box.width, y: box.y },
        { x: box.x + box.width, y: box.y + box.height },
        { x: box.x, y: box.y + box.height },
      ],
    },
    symbols: characters.map((character, index) => ({
      text: character,
      ...(index === characters.length - 1 && lastBreak
        ? { property: { detectedBreak: { type: lastBreak } } }
        : {}),
    })),
  }
}

/** 단어 목록을 한 페이지·한 문단 annotation으로 감싼다. */
function createAnnotation(words: ReturnType<typeof createWord>[]): VisionTextAnnotation {
  return { pages: [{ blocks: [{ paragraphs: [{ words }] }], height: 1000, width: 500 }] }
}

describe('groupVisionWordsIntoLines', () => {
  it('SPACE는 공백으로 잇고 EOL_SURE_SPACE·LINE_BREAK에서 줄을 나눈다', () => {
    const annotation = createAnnotation([
      createWord('우리는', { height: 20, width: 60, x: 50, y: 100 }, 'SPACE'),
      createWord('늘', { height: 20, width: 20, x: 120, y: 100 }, 'EOL_SURE_SPACE'),
      createWord('떠나는', { height: 20, width: 60, x: 50, y: 130 }, 'LINE_BREAK'),
    ])

    const lines = groupVisionWordsIntoLines(annotation)

    expect(lines.map((line) => line.text)).toEqual(['우리는 늘', '떠나는'])
    expect(lines.map((line) => line.id)).toEqual(['line-0', 'line-1'])
  })

  it('줄 박스를 페이지 크기 기준 0~1 비율로 정규화한다', () => {
    const lines = groupVisionWordsIntoLines(
      createAnnotation([
        createWord('우리는', { height: 20, width: 60, x: 50, y: 100 }, 'SPACE'),
        createWord('늘', { height: 20, width: 20, x: 120, y: 100 }, 'LINE_BREAK'),
      ]),
    )

    expect(lines[0]?.box).toEqual({ height: 0.02, width: 0.18, x: 0.1, y: 0.1 })
  })

  it('HYPHEN break는 하이픈을 남기고 줄을 나눈다', () => {
    const lines = groupVisionWordsIntoLines(
      createAnnotation([
        createWord('extra', { height: 20, width: 60, x: 0, y: 0 }, 'HYPHEN'),
        createWord('ordinary', { height: 20, width: 80, x: 0, y: 30 }, 'LINE_BREAK'),
      ]),
    )

    expect(lines.map((line) => line.text)).toEqual(['extra-', 'ordinary'])
  })

  it('문단이 끝나면 break가 없어도 줄을 닫는다', () => {
    const annotation: VisionTextAnnotation = {
      pages: [
        {
          blocks: [
            {
              paragraphs: [
                { words: [createWord('첫', { height: 10, width: 10, x: 0, y: 0 })] },
                { words: [createWord('둘', { height: 10, width: 10, x: 0, y: 20 })] },
              ],
            },
          ],
          height: 100,
          width: 100,
        },
      ],
    }

    expect(groupVisionWordsIntoLines(annotation).map((line) => line.text)).toEqual(['첫', '둘'])
  })

  it('좌표가 없는 꼭짓점은 0으로 보고 범위를 벗어난 값은 0~1로 자른다', () => {
    const annotation: VisionTextAnnotation = {
      pages: [
        {
          blocks: [
            {
              paragraphs: [
                {
                  words: [
                    {
                      boundingBox: { vertices: [{}, { x: 120 }, { x: 120, y: 50 }, { y: 50 }] },
                      symbols: [{ text: '가' }],
                    },
                  ],
                },
              ],
            },
          ],
          height: 100,
          width: 100,
        },
      ],
    }

    expect(groupVisionWordsIntoLines(annotation)[0]?.box).toEqual({
      height: 0.5,
      width: 1,
      x: 0,
      y: 0,
    })
  })

  it('글자나 페이지가 없으면 빈 배열을 반환한다', () => {
    expect(groupVisionWordsIntoLines({ pages: [] })).toEqual([])
    expect(groupVisionWordsIntoLines(undefined)).toEqual([])
  })
})
