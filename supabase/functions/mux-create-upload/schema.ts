import { z } from 'zod'

export const muxCreateUploadInputSchema = z.object({
  bookChatId: z.uuid(),
  clientId: z.uuid(),
  caption: z.string().trim().min(1).max(500).optional(),
  labels: z.array(z.object({
    kind: z.enum(['page', 'chapter', 'custom']),
    value: z.string().trim().min(1).max(40),
  })).max(10).default([]),
  mentionedMemberIds: z.array(z.uuid()).max(20).default([]),
})
