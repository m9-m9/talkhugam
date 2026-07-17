import { z } from 'npm:zod@4.4.3'

export const accountDeleteInputSchema = z.object({
  mode: z.enum(['anonymize', 'delete_content']),
})
