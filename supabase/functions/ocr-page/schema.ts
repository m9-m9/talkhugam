import { z } from 'npm:zod@4.4.3'

/** 클라이언트가 긴 변 2000px JPEG로 줄여 보내므로 base64 약 3MB(원본 약 2.25MB)를 상한으로 둔다. */
export const OCR_IMAGE_MAX_BASE64_LENGTH = 4_000_000

export const ocrPageInputSchema = z.object({
  bookChatId: z.uuid(),
  image: z
    .string()
    .min(4)
    .max(OCR_IMAGE_MAX_BASE64_LENGTH)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/),
})

const clovaVertexSchema = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
})

const clovaFieldSchema = z.object({
  inferText: z.string().optional(),
  lineBreak: z.boolean().optional(),
  boundingPoly: z.object({ vertices: z.array(clovaVertexSchema).optional() }).optional(),
})

export const clovaOcrResponseSchema = z.object({
  images: z.array(z.object({
    inferResult: z.string().optional(),
    fields: z.array(clovaFieldSchema).optional(),
  })).optional(),
})

export type OcrPageInput = z.infer<typeof ocrPageInputSchema>
