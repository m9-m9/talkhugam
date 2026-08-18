import { z } from 'zod'

const mobileAvatarFileSchema = z.object({
  fileSize: z.number().int().nonnegative().max(5 * 1024 * 1024),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  uri: z.string().min(1),
})

export type MobileAvatarFile = z.infer<typeof mobileAvatarFileSchema>

/** 기기 선택 이미지의 MIME·크기·URI를 private avatar 업로드 전용 값으로 검증한다. */
export function parseMobileAvatarFile(value: unknown): MobileAvatarFile {
  const parsed = mobileAvatarFileSchema.safeParse(value)
  if (parsed.success) return parsed.data
  const hasOversizedFile = typeof value === 'object' && value !== null && 'fileSize' in value && typeof value.fileSize === 'number' && value.fileSize > 5 * 1024 * 1024
  if (hasOversizedFile) throw new Error('사진은 5MB 이하만 올릴 수 있어요.')
  throw new Error('JPG, PNG, WebP 이미지만 올릴 수 있어요.')
}
