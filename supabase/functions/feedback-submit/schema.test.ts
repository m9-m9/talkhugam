import { assertEquals, assertThrows } from 'jsr:@std/assert@1.0.14'

import { feedbackSubmissionSchema } from './schema.ts'

Deno.test('feedback submission schema trims a valid message', () => {
  assertEquals(
    feedbackSubmissionSchema.parse({ category: 'feature', body: '  읽기 목표가 있으면 좋겠어요.  ' }),
    { category: 'feature', body: '읽기 목표가 있으면 좋겠어요.' },
  )
})

Deno.test('feedback submission schema rejects a blank message', () => {
  assertThrows(() => feedbackSubmissionSchema.parse({ category: 'issue', body: '  ' }))
})
