import { assertEquals } from 'jsr:@std/assert@1.0.14'
import { parseAllowedOrigins } from './cors.ts'

Deno.test('parseAllowedOrigins trims and removes empty origins', () => {
  const origins = parseAllowedOrigins(' https://talkhugam.example, ,http://127.0.0.1:3000 ')

  assertEquals([...origins], ['https://talkhugam.example', 'http://127.0.0.1:3000'])
})

Deno.test('parseAllowedOrigins returns local default for empty input', () => {
  assertEquals([...parseAllowedOrigins(undefined)], ['http://127.0.0.1:3000'])
})
