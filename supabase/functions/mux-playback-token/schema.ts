import { z } from 'zod'

export const muxPlaybackTokenInputSchema = z.object({
  postId: z.uuid(),
})
