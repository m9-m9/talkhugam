import { assertEquals, assertNotEquals } from 'jsr:@std/assert@1.0.19'
import { createRequestFingerprint } from './rate-limit.ts'

Deno.test('rate limit fingerprint is stable without storing the client address', async () => {
  const firstRequest = new Request('https://api.example/function', {
    headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.1' },
  })
  const sameRequest = new Request('https://api.example/function', {
    headers: { 'x-forwarded-for': '203.0.113.10' },
  })
  const otherRequest = new Request('https://api.example/function', {
    headers: { 'x-forwarded-for': '203.0.113.11' },
  })

  const first = await createRequestFingerprint(firstRequest, 'rate-limit-secret')
  assertEquals(first, await createRequestFingerprint(sameRequest, 'rate-limit-secret'))
  assertNotEquals(first, await createRequestFingerprint(otherRequest, 'rate-limit-secret'))
  assertEquals(first.includes('203.0.113.10'), false)
  assertEquals(first.length, 64)
})
