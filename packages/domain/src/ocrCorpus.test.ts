import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { groupClovaFieldsIntoLines } from './ocrLayout'
import { splitOcrSentences } from './ocrSentence'
import {
  type ClovaRecording,
  readClovaTestConfig,
  readOcrCorpusMode,
  requestClovaRecording,
} from './testing/ocrCorpusClova'
import {
  getOcrCorpusFailures,
  type OcrCorpusExpected,
  scoreOcrCorpusPage,
} from './testing/ocrCorpusScore'

const corpusDir = fileURLToPath(new URL('./__fixtures__/ocr-corpus', import.meta.url))
const reportDir = fileURLToPath(new URL('../test-results/ocr-corpus', import.meta.url))
const mode = readOcrCorpusMode(process.env.OCR_CORPUS_MODE)
const pageIds = readdirSync(corpusDir).filter((id) => existsSync(join(corpusDir, id, 'page.json')))

/** 코퍼스 페이지의 정답 파일을 읽는다. */
function readExpected(id: string): OcrCorpusExpected {
  return JSON.parse(readFileSync(join(corpusDir, id, 'expected.json'), 'utf8')) as OcrCorpusExpected
}

/** 모드에 따라 커밋된 녹화를 읽거나(replay) CLOVA를 실제로 불러(live·record) 녹화를 얻는다. record면 녹화 파일을 새로 쓴다. */
async function loadRecording(id: string, expected: OcrCorpusExpected): Promise<ClovaRecording> {
  const recordingPath = join(corpusDir, id, 'clova.json')
  if (mode === 'replay') return JSON.parse(readFileSync(recordingPath, 'utf8')) as ClovaRecording
  const image = readFileSync(join(corpusDir, id, 'page.jpg')).toString('base64')
  const recording = await requestClovaRecording(
    image,
    expected.imageSize,
    readClovaTestConfig(process.env),
  )
  if (mode === 'record') writeFileSync(recordingPath, `${JSON.stringify(recording)}\n`)
  return recording
}

/** 페이지 점수를 test-results/ocr-corpus/<id>.json에 남겨 실패 원인을 사람이 바로 볼 수 있게 한다. */
function writeReport(id: string, report: unknown) {
  mkdirSync(reportDir, { recursive: true })
  writeFileSync(join(reportDir, `${id}.${mode}.json`), `${JSON.stringify(report, null, 2)}\n`)
}

describe(`OCR 코퍼스 (${mode})`, () => {
  it.each(pageIds)('%s: 본문 줄·문장이 정답 기준을 넘는다', { timeout: 60_000 }, async (id) => {
    const expected = readExpected(id)
    const recording = await loadRecording(id, expected)
    const lines = groupClovaFieldsIntoLines(recording.fields, recording.imageSize)
    const sentences = splitOcrSentences(lines).map((sentence) => sentence.text)
    const score = scoreOcrCorpusPage({ lines: lines.map((line) => line.text), sentences }, expected)
    const failures = getOcrCorpusFailures(score)
    writeReport(id, { failures, lines: lines.map((line) => line.text), score })

    expect(failures).toEqual([])
  })
})
