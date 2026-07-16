import { z } from 'zod'

export const accountDeleteInputSchema = z.object({
  mode: z.enum(['anonymize', 'delete_content']),
})
