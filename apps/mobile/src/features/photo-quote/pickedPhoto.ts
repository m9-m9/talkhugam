import { z } from 'zod'

const pickedPhotoSchema = z.object({
  height: z.number().positive(),
  uri: z.string().min(1),
  width: z.number().positive(),
})

const pickerResultSchema = z.object({
  assets: z.array(z.unknown()).nullable().optional(),
  canceled: z.boolean(),
})

/** 문장을 읽을 사진. 위치·EXIF 같은 다른 정보는 버리고 주소와 픽셀 크기만 둔다. */
export type PickedPhoto = z.infer<typeof pickedPhotoSchema>

/** expo-image-picker 결과를 받아 첫 사진의 주소와 크기를 검증해 반환하고, 취소·잘못된 결과면 null을 반환한다. */
export function parsePickedPhoto(value: unknown): PickedPhoto | null {
  const result = pickerResultSchema.safeParse(value)
  if (!result.success || result.data.canceled) return null
  const photo = pickedPhotoSchema.safeParse(result.data.assets?.[0])
  return photo.success ? photo.data : null
}
