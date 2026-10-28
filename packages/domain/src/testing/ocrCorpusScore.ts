/**
 * OCR 시험 코퍼스(__fixtures__/ocr-corpus)의 인식 결과를 정답과 비교해 점수를 매긴다.
 * 웹 e2e·도메인 vitest·Deno 함수 테스트가 같은 기준을 쓰도록 의존성 없이 둔다. 앱 코드에서는 쓰지 않는다.
 */

export type OcrCorpusExpected = {
  excludedTexts: string[]
  imageSize: { height: number; width: number }
  lines: string[]
  sentences: string[]
}

export type OcrCorpusScore = {
  /** 공백을 뺀 본문 전체의 글자 오류율(편집 거리 ÷ 정답 글자 수). 인식·필터 품질을 본다. */
  characterErrorRate: number
  /** 머리글·장 제목·쪽 번호 중 본문 줄로 남은 것. */
  leakedExcludedTexts: string[]
  /** 정답 문장마다 가장 비슷한 인식 문장의 유사도(공백 무시, 0~1). */
  sentenceSimilarities: Array<{ expected: string; actual: string; similarity: number }>
  /** 유사도가 기준 이상인 정답 문장 비율. 문장 나누기 품질을 본다. */
  sentenceMatchRate: number
  /** 인식 문장 수 - 정답 문장 수. */
  sentenceCountDelta: number
  /** 줄을 이을 때 생긴 띄어쓰기 오류 비율(공백 포함 편집 거리 증가분 ÷ 정답 공백 수). */
  spacingErrorRate: number
}

/** 코퍼스 통과 기준. 기준을 바꾸면 testing 문서의 표도 함께 고친다. */
export const OCR_CORPUS_THRESHOLDS = {
  maxCharacterErrorRate: 0.03,
  maxSentenceCountDelta: 1,
  maxSpacingErrorRate: 0.1,
  minSentenceMatchRate: 0.9,
  minSentenceSimilarity: 0.9,
} as const

/** 둥근 따옴표를 곧은 따옴표로 바꾼다. CLOVA는 “ ”를 "로 돌려주므로 인식 오류로 세지 않는다. */
function normalizeQuotes(text: string): string {
  return text.replace(/[“”„‟]/g, '"').replace(/[‘’‚‛]/g, "'")
}

/** 모든 공백을 지운다. */
function removeSpaces(text: string): string {
  return text.replace(/\s+/g, '')
}

/** 두 글의 편집 거리(삽입·삭제·바꾸기 1점)를 구한다. */
export function getEditDistance(first: string, second: string): number {
  const a = [...first]
  const b = [...second]
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let row = 1; row <= a.length; row += 1) {
    const current = [row]
    for (let column = 1; column <= b.length; column += 1) {
      const cost = a[row - 1] === b[column - 1] ? 0 : 1
      current.push(
        Math.min(
          (previous[column] ?? 0) + 1,
          (current[column - 1] ?? 0) + 1,
          (previous[column - 1] ?? 0) + cost,
        ),
      )
    }
    previous = current
  }
  return previous[b.length] ?? 0
}

/** 공백을 무시한 두 문장의 유사도(1 - 편집 거리 ÷ 긴 쪽 길이)를 구한다. */
function getSimilarity(first: string, second: string): number {
  const a = removeSpaces(first)
  const b = removeSpaces(second)
  const longest = Math.max([...a].length, [...b].length)
  return longest === 0 ? 1 : 1 - getEditDistance(a, b) / longest
}

/** 정답 문장 하나와 가장 비슷한 인식 문장을 찾는다. */
function findBestSentence(expected: string, actualSentences: readonly string[]) {
  return actualSentences.reduce(
    (best, actual) => {
      const similarity = getSimilarity(expected, actual)
      return similarity > best.similarity ? { actual, expected, similarity } : best
    },
    { actual: '', expected, similarity: 0 },
  )
}

/** 인식한 줄·문장을 정답과 비교해 점수를 반환한다. */
export function scoreOcrCorpusPage(
  actual: { lines: readonly string[]; sentences: readonly string[] },
  expected: OcrCorpusExpected,
): OcrCorpusScore {
  const actualSentences = actual.sentences.map(normalizeQuotes)
  const expectedSentences = expected.sentences.map(normalizeQuotes)
  const actualText = actualSentences.join(' ')
  const expectedText = expectedSentences.join(' ')
  const characterDistance = getEditDistance(removeSpaces(actualText), removeSpaces(expectedText))
  const spacedDistance = getEditDistance(actualText, expectedText)
  const expectedSpaces = Math.max(1, (expectedText.match(/\s/g) ?? []).length)
  const sentenceSimilarities = expectedSentences.map((sentence) =>
    findBestSentence(sentence, actualSentences),
  )
  const matched = sentenceSimilarities.filter(
    (item) => item.similarity >= OCR_CORPUS_THRESHOLDS.minSentenceSimilarity,
  )
  const actualLineTexts = new Set(actual.lines.map((line) => removeSpaces(normalizeQuotes(line))))
  return {
    characterErrorRate: characterDistance / Math.max(1, [...removeSpaces(expectedText)].length),
    leakedExcludedTexts: expected.excludedTexts.filter((text) =>
      actualLineTexts.has(removeSpaces(text)),
    ),
    sentenceCountDelta: actualSentences.length - expectedSentences.length,
    sentenceMatchRate: matched.length / Math.max(1, expected.sentences.length),
    sentenceSimilarities,
    spacingErrorRate: Math.max(0, spacedDistance - characterDistance) / expectedSpaces,
  }
}

/** 점수가 통과 기준을 넘지 못한 항목을 한글 설명으로 반환한다. 빈 배열이면 통과다. */
export function getOcrCorpusFailures(score: OcrCorpusScore): string[] {
  const limits = OCR_CORPUS_THRESHOLDS
  const failures: string[] = []
  if (score.characterErrorRate > limits.maxCharacterErrorRate)
    failures.push(
      `글자 오류율 ${formatPercent(score.characterErrorRate)} > ${formatPercent(limits.maxCharacterErrorRate)}`,
    )
  if (score.sentenceMatchRate < limits.minSentenceMatchRate)
    failures.push(
      `문장 일치율 ${formatPercent(score.sentenceMatchRate)} < ${formatPercent(limits.minSentenceMatchRate)}`,
    )
  if (Math.abs(score.sentenceCountDelta) > limits.maxSentenceCountDelta)
    failures.push(`문장 수 차이 ${score.sentenceCountDelta}`)
  if (score.spacingErrorRate > limits.maxSpacingErrorRate)
    failures.push(
      `띄어쓰기 오류율 ${formatPercent(score.spacingErrorRate)} > ${formatPercent(limits.maxSpacingErrorRate)}`,
    )
  if (score.leakedExcludedTexts.length > 0)
    failures.push(`본문에 남은 머리글·쪽 번호: ${score.leakedExcludedTexts.join(', ')}`)
  return failures
}

/** 0~1 비율을 소수 첫째 자리 백분율로 쓴다. */
function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}
