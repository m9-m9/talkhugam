import { assertEquals } from 'jsr:@std/assert@1.0.14'
import { z } from 'npm:zod@4.4.3'
import { createJsonRequest } from '../_test/request.ts'
import { parseJsonBody } from './body.ts'

const schema = z.object({
  roomId: z.uuid(),
  name: z.string().trim().min(1),
})

Deno.test('parseJsonBody returns parsed input', async () => {
  const request = createJsonRequest('test', {
    roomId: '00000000-0000-4000-8000-000000000001',
    name: ' 독서방 ',
  })

  assertEquals(await parseJsonBody(request, schema), {
    ok: true,
    value: {
      roomId: '00000000-0000-4000-8000-000000000001',
      name: '독서방',
    },
  })
})

Deno.test('parseJsonBody reports the first invalid field', async () => {
  const request = createJsonRequest('test', { roomId: 'invalid', name: '' })

  assertEquals(await parseJsonBody(request, schema), {
    ok: false,
    field: 'roomId',
  })
})
