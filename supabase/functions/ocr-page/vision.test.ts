import { assertEquals, assertRejects } from 'jsr:@std/assert@1.0.14'
import { createVisionRequestBody, fetchVisionLines, VisionOcrError } from './vision.ts'

const visionSuccessBody = {
  responses: [
    {
      fullTextAnnotation: {
        pages: [
          {
            width: 100,
            height: 100,
            blocks: [
              {
                paragraphs: [
                  {
                    words: [
                      {
                        boundingBox: {
                          vertices: [{ x: 10, y: 10 }, { x: 40, y: 10 }, { x: 40, y: 20 }, { x: 10, y: 20 }],
                        },
                        symbols: [
                          { text: '책' },
                          { text: '방', property: { detectedBreak: { type: 'LINE_BREAK' } } },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  ],
}

Deno.test('createVisionRequestBody asks for Korean document text detection', () => {
  const body = createVisionRequestBody('aW1hZ2U=')

  assertEquals(body.requests[0]?.features, [{ type: 'DOCUMENT_TEXT_DETECTION' }])
  assertEquals(body.requests[0]?.imageContext.languageHints, ['ko', 'en'])
  assertEquals(body.requests[0]?.image.content, 'aW1hZ2U=')
})

Deno.test('fetchVisionLines sends the key only in a header and groups lines', async () => {
  let requestedUrl = ''
  let apiKeyHeader = ''
  const fetcher: typeof fetch = (input, init) => {
    requestedUrl = String(input)
    apiKeyHeader = new Headers(init?.headers).get('x-goog-api-key') ?? ''
    return Promise.resolve(new Response(JSON.stringify(visionSuccessBody), { status: 200 }))
  }

  const lines = await fetchVisionLines('aW1hZ2U=', 'vision-secret', fetcher)

  assertEquals(requestedUrl, 'https://vision.googleapis.com/v1/images:annotate')
  assertEquals(apiKeyHeader, 'vision-secret')
  assertEquals(lines, [{ id: 'line-0', text: '책방', box: { x: 0.1, y: 0.1, width: 0.3, height: 0.1 } }])
})

Deno.test('fetchVisionLines returns an empty list when no text was found', async () => {
  const fetcher: typeof fetch = () =>
    Promise.resolve(new Response(JSON.stringify({ responses: [{}] }), { status: 200 }))

  assertEquals(await fetchVisionLines('aW1hZ2U=', 'vision-secret', fetcher), [])
})

Deno.test('fetchVisionLines treats an upstream HTTP failure as a retryable error', async () => {
  const fetcher: typeof fetch = () => Promise.resolve(new Response('{}', { status: 503 }))
  const error = await assertRejects(
    () => fetchVisionLines('aW1hZ2U=', 'vision-secret', fetcher),
    VisionOcrError,
  )

  assertEquals(error.upstreamStatus, 503)
  assertEquals(error.isRetryable, true)
})

Deno.test('fetchVisionLines rejects a per-image error returned with HTTP 200', async () => {
  const fetcher: typeof fetch = () =>
    Promise.resolve(
      new Response(JSON.stringify({ responses: [{ error: { code: 3, message: 'Bad image data.' } }] }), {
        status: 200,
      }),
    )
  const error = await assertRejects(
    () => fetchVisionLines('aW1hZ2U=', 'vision-secret', fetcher),
    VisionOcrError,
  )

  assertEquals(error.isRetryable, false)
  assertEquals(error.message.includes('Bad image data'), false)
})
