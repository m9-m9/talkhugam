import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { expect, test } from '@playwright/test'
import { groupClovaFieldsIntoLines } from '@talkhugam/domain'

import {
  type ClovaRecording,
  readClovaTestConfig,
  readOcrCorpusMode,
  requestClovaRecording,
} from '../../../packages/domain/src/testing/ocrCorpusClova'
import {
  getOcrCorpusFailures,
  type OcrCorpusExpected,
  scoreOcrCorpusPage,
} from '../../../packages/domain/src/testing/ocrCorpusScore'
import { authenticatePage, bookChatId, roomId } from './support/session'

const corpusDir = resolve(process.cwd(), '../../packages/domain/src/__fixtures__/ocr-corpus')
const mode = readOcrCorpusMode(process.env.OCR_CORPUS_MODE)
const pageIds = readdirSync(corpusDir).filter((id) => existsSync(join(corpusDir, id, 'page.json')))

/** 코퍼스 페이지의 정답 파일을 읽는다. */
function readExpected(id: string): OcrCorpusExpected {
  return JSON.parse(readFileSync(join(corpusDir, id, 'expected.json'), 'utf8')) as OcrCorpusExpected
}

/** replay면 커밋된 녹화를, live면 브라우저가 줄여 보낸 그 사진으로 CLOVA를 실제로 불러 녹화를 얻는다. */
async function recognize(
  id: string,
  image: string,
  expected: OcrCorpusExpected,
): Promise<ClovaRecording> {
  if (mode === 'replay')
    return JSON.parse(readFileSync(join(corpusDir, id, 'clova.json'), 'utf8')) as ClovaRecording
  return requestClovaRecording(image, expected.imageSize, readClovaTestConfig(process.env))
}

for (const id of pageIds) {
  test(`OCR 코퍼스 ${id}: 사진을 올리면 본문 문장이 정답 기준을 넘고 고른 문장이 인용 칸에 들어간다 (${mode})`, async ({
    page,
  }, testInfo) => {
    test.skip(
      mode !== 'replay' && testInfo.project.name !== 'desktop-640',
      'CLOVA 실호출은 한 화면 크기에서만 한다',
    )
    test.setTimeout(90_000)
    const expected = readExpected(id)
    let recognizedLines: string[] = []
    await authenticatePage(page)
    await page.route('**/functions/v1/ocr-page', async (route) => {
      const { image } = route.request().postDataJSON() as { image: string }
      const recording = await recognize(id, image, expected)
      const lines = groupClovaFieldsIntoLines(recording.fields, recording.imageSize)
      recognizedLines = lines.map((line) => line.text)
      await route.fulfill({
        body: JSON.stringify({ data: { lines }, ok: true, requestId: `corpus-${id}` }),
        contentType: 'application/json',
        status: 200,
      })
    })
    await page.goto(`/rooms/${roomId}/books/${bookChatId}`)
    await page.getByLabel('문장을 가져올 사진 선택').setInputFiles(join(corpusDir, id, 'page.jpg'))

    await page.getByRole('button', { name: '문장으로 고르기' }).click()
    const sentenceButtons = page.locator('#photo-quote-sentence-list button')
    await expect(sentenceButtons.first()).toBeVisible()
    const sentences = (await sentenceButtons.allTextContents()).map((text) => text.trim())
    const score = scoreOcrCorpusPage({ lines: recognizedLines, sentences }, expected)
    const failures = getOcrCorpusFailures(score)
    await testInfo.attach(`ocr-corpus-${id}.json`, {
      body: JSON.stringify({ failures, lines: recognizedLines, score }, null, 2),
      contentType: 'application/json',
    })
    await page.screenshot({ fullPage: true, path: testInfo.outputPath(`${id}-sentences.png`) })
    expect(failures).toEqual([])

    const pickIndex = Math.floor(sentences.length / 2)
    await sentenceButtons.nth(pickIndex).click()
    await page.getByRole('button', { name: '다음', exact: true }).click()
    await expect(page.getByRole('textbox', { name: '인용할 문장' })).toHaveValue(
      sentences[pickIndex] ?? '',
    )
  })
}
