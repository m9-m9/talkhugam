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

const visionVertexSchema = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
})

const visionSymbolSchema = z.object({
  text: z.string().optional(),
  property: z.object({
    detectedBreak: z.object({ type: z.string().optional() }).optional(),
  }).optional(),
})

const visionWordSchema = z.object({
  boundingBox: z.object({ vertices: z.array(visionVertexSchema).optional() }).optional(),
  symbols: z.array(visionSymbolSchema).optional(),
})

const visionPageSchema = z.object({
  width: z.number().optional(),
  height: z.number().optional(),
  blocks: z.array(z.object({
    paragraphs: z.array(z.object({ words: z.array(visionWordSchema).optional() })).optional(),
  })).optional(),
})

export const visionAnnotateResponseSchema = z.object({
  responses: z.array(z.object({
    error: z.object({ code: z.number().optional(), message: z.string().optional() }).optional(),
    fullTextAnnotation: z.object({ pages: z.array(visionPageSchema).optional() }).optional(),
  })).optional(),
})

export type OcrPageInput = z.infer<typeof ocrPageInputSchema>
