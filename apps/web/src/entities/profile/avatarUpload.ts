import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

const avatarBucket = 'avatars'
const maxAvatarFileSize = 5 * 1024 * 1024

const avatarFileSchema = z.object({
  name: z.string().min(1),
  size: z.number().int().nonnegative(),
  type: z.enum(['image/jpeg', 'image/png', 'image/webp']),
})

const avatarPathSchema = z
  .string()
  .uuid()
  .transform((profileId) => `${profileId}/avatar`)

export type AvatarFile = z.infer<typeof avatarFileSchema>

/** 사진 파일의 용량과 형식 문제를 사용자 안내 문구로 반환한다. */
export function getAvatarUploadError(value: unknown): string | null {
  const metadataResult = avatarFileSchema.safeParse(value)
  if (!metadataResult.success) return 'JPG, PNG, WebP 이미지만 올릴 수 있어요.'
  if (metadataResult.data.size > maxAvatarFileSize) return '사진은 5MB 이하만 올릴 수 있어요.'
  return null
}

/** 프로필 사진 파일을 검증하고 업로드 가능한 메타데이터를 반환한다. */
export function validateAvatarUpload(value: unknown): AvatarFile {
  const errorMessage = getAvatarUploadError(value)
  if (errorMessage) throw new Error(errorMessage)
  return avatarFileSchema.parse(value)
}

/** 프로필별 사진을 한 객체로 교체하기 위한 private Storage 경로를 생성한다. */
export function createAvatarObjectPath(profileId: string): string {
  return avatarPathSchema.parse(profileId)
}

/** 검증된 사진을 private Storage에 교체하고 프로필의 객체 경로를 갱신한다. */
export async function uploadProfileAvatar(
  client: SupabaseClient,
  profileId: string,
  file: File,
): Promise<string> {
  validateAvatarUpload(file)
  const avatarPath = createAvatarObjectPath(profileId)
  const uploadResponse = await client.storage.from(avatarBucket).upload(avatarPath, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: true,
  })
  if (uploadResponse.error) throw uploadResponse.error

  const profileResponse = await client
    .from('profiles')
    .update({ avatar_path: avatarPath })
    .eq('id', profileId)
  if (profileResponse.error) throw profileResponse.error

  return avatarPath
}

/** private 사진 경로에 접근 가능한 임시 URL을 발급해 반환한다. */
export async function getProfileAvatarUrl(
  client: SupabaseClient,
  avatarPath: string | null,
): Promise<string | null> {
  if (!avatarPath) return null

  const response = await client.storage.from(avatarBucket).createSignedUrl(avatarPath, 60 * 60)
  if (response.error) throw response.error
  return response.data.signedUrl
}
