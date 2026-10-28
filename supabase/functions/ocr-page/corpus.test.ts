import { assertEquals } from 'jsr:@std/assert@1.0.14'
import { encodeBase64 } from 'jsr:@std/encoding@1.0.10/base64'
import { type ClovaField, groupClovaFieldsIntoLines } from '../../../packages/domain/src/ocrLayout.ts'
import { fetchClovaLines } from './clova.ts'
import { createOcrPageHandler } from './index.ts'

type ClovaRecording = { fields: ClovaField[]; imageSize: { height: number; width: number } }

const corpusUrl = new URL('../../../packages/domain/src/__fixtures__/ocr-corpus/', import.meta.url)
const config = { invokeUrl: 'https://example.apigw.ntruss.com/custom/v1/1/abc', secret: 'corpus-secret' }

/** 녹화한 CLOVA 응답을 그대로 돌려주는 fetch 대역을 만든다. */
function createReplayFetcher(recording: ClovaRecording): typeof fetch {
  return () =>
    Promise.resolve(
      new Response(JSON.stringify({ images: [{ fields: recording.fields, inferResult: 'SUCCESS' }] }), {
        headers: { 'content-type': 'application/json' },
      }),
    )
}

for (const entry of Deno.readDirSync(corpusUrl)) {
  const pageUrl = new URL(`${entry.name}/`, corpusUrl)
  const recordingUrl = new URL('clova.json', pageUrl)
  Deno.test({
    name: `ocr-page handler reads the committed CLOVA recording of corpus page ${entry.name} into body lines`,
    ignore: !entry.isDirectory || !existsSync(recordingUrl),
    fn: async () => {
      const recording = JSON.parse(Deno.readTextFileSync(recordingUrl)) as ClovaRecording
      const image = encodeBase64(Deno.readFileSync(new URL('page.jpg', pageUrl)))
      const handler = createOcrPageHandler({
        authenticate: () => Promise.resolve({ userId: 'corpus-user', isBookChatMember: () => Promise.resolve(true) }),
        consumeDailyLimit: () => Promise.resolve(true),
        readOcrConfig: () => config,
        recognizeLines: (content, ocrConfig) => fetchClovaLines(content, ocrConfig, createReplayFetcher(recording)),
      })

      const response = await handler(
        new Request('http://localhost/functions/v1/ocr-page', {
          body: JSON.stringify({ bookChatId: '00000000-0000-4000-8000-000000000002', image }),
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        }),
      )
      const body = await response.json()

      assertEquals(response.status, 200)
      assertEquals(body.data.lines, groupClovaFieldsIntoLines(recording.fields, recording.imageSize))
    },
  })
}

/** 파일이 있는지 동기로 확인한다. */
function existsSync(url: URL): boolean {
  try {
    Deno.statSync(url)
    return true
  } catch {
    return false
  }
}
