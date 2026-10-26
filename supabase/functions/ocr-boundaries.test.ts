import { assertEquals } from 'jsr:@std/assert@1.0.14'
import { createOcrPageHandler, handleOcrPage, type OcrPageDependencies } from './ocr-page/index.ts'
import { withEnv } from './_test/env.ts'
import { createJsonRequest } from './_test/request.ts'

const bookChatId = '6f1c0a52-3a43-4a8f-9a3c-0d8f8a7d4b11'
const image = 'aW1hZ2U='

/** 모든 경계를 통과하는 기본 의존성에 테스트별 덮어쓰기를 합친다. */
function createDependencies(overrides: Partial<OcrPageDependencies> = {}): OcrPageDependencies {
  return {
    authenticate: () => Promise.resolve({ userId: 'user-1', isBookChatMember: () => Promise.resolve(true) }),
    consumeDailyLimit: () => Promise.resolve(true),
    readVisionApiKey: () => 'vision-secret',
    recognizeLines: () =>
      Promise.resolve([{ id: 'line-0', text: '책방', box: { x: 0.1, y: 0.1, width: 0.3, height: 0.1 } }]),
    ...overrides,
  }
}

/** 인증 header를 가진 ocr-page 요청을 만든다. */
function createOcrRequest(body: unknown): Request {
  return createJsonRequest('ocr-page', body, {
    authorization: 'Bearer user-token',
    headers: { origin: 'https://talkhugam.test' },
  })
}

Deno.test('ocr-page requires a user session', async () => {
  await withEnv({ ALLOWED_ORIGINS: 'https://talkhugam.test' }, async () => {
    const response = await handleOcrPage(createJsonRequest('ocr-page', { bookChatId, image }))

    assertEquals(response.status, 401)
    assertEquals((await response.json()).error.code, 'AUTH_REQUIRED')
  })
})

Deno.test('ocr-page answers CORS preflight and rejects other methods', async () => {
  await withEnv({ ALLOWED_ORIGINS: 'https://talkhugam.test' }, async () => {
    const handler = createOcrPageHandler(createDependencies())
    const preflight = await handler(new Request('http://localhost/ocr-page', { method: 'OPTIONS' }))
    const getResponse = await handler(new Request('http://localhost/ocr-page'))

    assertEquals(preflight.status, 204)
    assertEquals(getResponse.status, 405)
  })
})

Deno.test('ocr-page validates the book chat id and base64 image', async () => {
  const handler = createOcrPageHandler(createDependencies())

  assertEquals((await handler(createOcrRequest({ bookChatId: 'nope', image }))).status, 400)
  assertEquals((await handler(createOcrRequest({ bookChatId, image: 'not base64!' }))).status, 400)
  assertEquals((await handler(createOcrRequest({ bookChatId, image: 'A'.repeat(4_000_004) }))).status, 400)
})

Deno.test('ocr-page rejects a user who is not an active member of the book chat room', async () => {
  let wasLimitConsumed = false
  const handler = createOcrPageHandler(createDependencies({
    authenticate: () => Promise.resolve({ userId: 'user-1', isBookChatMember: () => Promise.resolve(false) }),
    consumeDailyLimit: () => {
      wasLimitConsumed = true
      return Promise.resolve(true)
    },
  }))
  const response = await handler(createOcrRequest({ bookChatId, image }))

  assertEquals(response.status, 403)
  assertEquals((await response.json()).error.code, 'ROOM_FORBIDDEN')
  assertEquals(wasLimitConsumed, false)
})

Deno.test('ocr-page explains a missing Vision key without consuming the daily limit', async () => {
  let wasLimitConsumed = false
  const handler = createOcrPageHandler(createDependencies({
    consumeDailyLimit: () => {
      wasLimitConsumed = true
      return Promise.resolve(true)
    },
    readVisionApiKey: () => undefined,
  }))
  const response = await handler(createOcrRequest({ bookChatId, image }))
  const body = await response.json()

  assertEquals(response.status, 503)
  assertEquals(body.error.code, 'OCR_UNAVAILABLE')
  assertEquals(wasLimitConsumed, false)
})

Deno.test('ocr-page limits daily calls per user', async () => {
  let limitedSubject = ''
  const handler = createOcrPageHandler(createDependencies({
    consumeDailyLimit: (userId) => {
      limitedSubject = userId
      return Promise.resolve(false)
    },
  }))
  const response = await handler(createOcrRequest({ bookChatId, image }))

  assertEquals(response.status, 429)
  assertEquals((await response.json()).error.code, 'RATE_LIMITED')
  assertEquals(limitedSubject, 'user-1')
})

Deno.test('ocr-page returns only recognized lines', async () => {
  let recognizedImage = ''
  let usedKey = ''
  const handler = createOcrPageHandler(createDependencies({
    recognizeLines: (content, apiKey) => {
      recognizedImage = content
      usedKey = apiKey
      return Promise.resolve([{ id: 'line-0', text: '책방', box: { x: 0, y: 0, width: 1, height: 0.1 } }])
    },
  }))
  const response = await handler(createOcrRequest({ bookChatId, image }))
  const body = await response.json()

  assertEquals(response.status, 200)
  assertEquals(body.data, { lines: [{ id: 'line-0', text: '책방', box: { x: 0, y: 0, width: 1, height: 0.1 } }] })
  assertEquals(recognizedImage, image)
  assertEquals(usedKey, 'vision-secret')
})

Deno.test('ocr-page hides Vision failures and never logs the image or recognized text', async () => {
  const logged: string[] = []
  const originalError = console.error
  console.error = (...values: unknown[]) => logged.push(values.map(String).join(' '))
  try {
    const handler = createOcrPageHandler(createDependencies({
      recognizeLines: () => Promise.reject(new Error(`upstream echoed ${image}`)),
    }))
    const response = await handler(createOcrRequest({ bookChatId, image }))

    assertEquals(response.status, 502)
    assertEquals((await response.json()).error.code, 'OCR_FAILED')
  } finally {
    console.error = originalError
  }

  assertEquals(logged.length, 1)
  assertEquals(logged.some((line) => line.includes(image)), false)
})
