import { assertEquals, assertRejects } from 'jsr:@std/assert@1.0.14'
import { ClovaOcrError, createClovaRequestBody, fetchClovaLines, resolveClovaGeneralUrl } from './clova.ts'
import { createJpegHeader } from '../_test/jpeg.ts'

const config = { invokeUrl: 'https://example.apigw.ntruss.com/custom/v1/1/abc', secret: 'clova-secret' }
const image = createJpegHeader(100, 100)

const clovaSuccessBody = {
  images: [
    {
      inferResult: 'SUCCESS',
      fields: [
        {
          inferText: '책방',
          lineBreak: true,
          boundingPoly: { vertices: [{ x: 10, y: 10 }, { x: 40, y: 10 }, { x: 40, y: 20 }, { x: 10, y: 20 }] },
        },
      ],
    },
  ],
}

Deno.test('createClovaRequestBody asks for Korean V2 recognition of one JPEG', () => {
  const body = createClovaRequestBody('aW1hZ2U=', 'request-1', 1700000000000)

  assertEquals(body.version, 'V2')
  assertEquals(body.lang, 'ko')
  assertEquals(body.requestId, 'request-1')
  assertEquals(body.images, [{ format: 'jpg', name: 'page', data: 'aW1hZ2U=' }])
})

Deno.test('resolveClovaGeneralUrl appends /general only once', () => {
  assertEquals(resolveClovaGeneralUrl(config.invokeUrl), `${config.invokeUrl}/general`)
  assertEquals(resolveClovaGeneralUrl(`${config.invokeUrl}/general/`), `${config.invokeUrl}/general`)
})

Deno.test('fetchClovaLines sends the secret only in a header and groups lines', async () => {
  let requestedUrl = ''
  let secretHeader = ''
  const fetcher: typeof fetch = (input, init) => {
    requestedUrl = String(input)
    secretHeader = new Headers(init?.headers).get('x-ocr-secret') ?? ''
    return Promise.resolve(new Response(JSON.stringify(clovaSuccessBody), { status: 200 }))
  }

  const lines = await fetchClovaLines(image, config, fetcher)

  assertEquals(requestedUrl, `${config.invokeUrl}/general`)
  assertEquals(secretHeader, 'clova-secret')
  assertEquals(lines, [{ id: 'line-0', text: '책방', box: { x: 0.1, y: 0.1, width: 0.3, height: 0.1 } }])
})

Deno.test('fetchClovaLines returns an empty list when no text was found', async () => {
  const fetcher: typeof fetch = () =>
    Promise.resolve(new Response(JSON.stringify({ images: [{ inferResult: 'SUCCESS', fields: [] }] }), { status: 200 }))

  assertEquals(await fetchClovaLines(image, config, fetcher), [])
})

Deno.test('fetchClovaLines rejects a non-JPEG image before calling CLOVA', async () => {
  let called = false
  const fetcher: typeof fetch = () => {
    called = true
    return Promise.resolve(new Response('{}', { status: 200 }))
  }
  const error = await assertRejects(() => fetchClovaLines('aW1hZ2U=', config, fetcher), ClovaOcrError)

  assertEquals(error.isRetryable, false)
  assertEquals(called, false)
})

Deno.test('fetchClovaLines treats an upstream HTTP failure as a retryable error', async () => {
  const fetcher: typeof fetch = () => Promise.resolve(new Response('{}', { status: 503 }))
  const error = await assertRejects(() => fetchClovaLines(image, config, fetcher), ClovaOcrError)

  assertEquals(error.upstreamStatus, 503)
  assertEquals(error.isRetryable, true)
})

Deno.test('fetchClovaLines rejects a per-image FAILURE returned with HTTP 200', async () => {
  const fetcher: typeof fetch = () =>
    Promise.resolve(
      new Response(JSON.stringify({ images: [{ inferResult: 'FAILURE', message: 'Bad image data.' }] }), {
        status: 200,
      }),
    )
  const error = await assertRejects(() => fetchClovaLines(image, config, fetcher), ClovaOcrError)

  assertEquals(error.isRetryable, false)
  assertEquals(error.message.includes('Bad image data'), false)
})
