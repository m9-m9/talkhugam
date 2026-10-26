import { assertEquals } from 'jsr:@std/assert@1.0.14'
import { createJpegHeader } from '../_test/jpeg.ts'
import { readJpegSize } from './jpegSize.ts'

Deno.test('readJpegSize reads width and height from a baseline SOF0 header', () => {
  assertEquals(readJpegSize(createJpegHeader(1500, 2000)), { height: 2000, width: 1500 })
})

Deno.test('readJpegSize reads a progressive SOF2 header', () => {
  assertEquals(readJpegSize(createJpegHeader(800, 600, 0xc2)), { height: 600, width: 800 })
})

Deno.test('readJpegSize returns null for non-JPEG or broken input', () => {
  assertEquals(readJpegSize(btoa('\x89PNG\r\n\x1a\n0000000000')), null)
  assertEquals(readJpegSize('aW1hZ2U='), null)
  assertEquals(readJpegSize('!!!!'), null)
})
