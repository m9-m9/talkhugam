import { z } from 'npm:zod@4.4.3'

export const muxThumbnailTokensInputSchema = z.object({
  postIds: z.array(z.uuid()).min(1).max(50),
})
