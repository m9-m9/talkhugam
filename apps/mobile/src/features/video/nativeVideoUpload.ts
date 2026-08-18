import { z } from 'zod'

const selectedNativeVideoSchema = z.object({
  duration: z.number().finite().positive(),
  mimeType: z.enum(['video/mp4', 'video/quicktime']),
  uri: z.string().min(1),
})

export type SelectedNativeVideo = z.infer<typeof selectedNativeVideoSchema>

/** 기기 선택 결과를 Mux 업로드 전용의 짧은 영상 모델로 검증해 반환한다. */
export function parseSelectedNativeVideo(value: unknown): SelectedNativeVideo {
  const parsed = selectedNativeVideoSchema.safeParse(value)
  if (!parsed.success) throw new Error('MP4 또는 MOV 영상만 올릴 수 있어요.')
  if (parsed.data.duration > 30_000) throw new Error('30초 이하의 영상만 올릴 수 있어요.')
  return parsed.data
}
