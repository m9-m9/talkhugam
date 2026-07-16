import { z } from 'npm:zod@4.4.3'

export const muxPlaybackTokenInputSchema = z.object({
  postId: z.uuid(),
})
