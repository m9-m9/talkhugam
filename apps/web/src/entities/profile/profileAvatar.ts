import type { SupabaseClient } from '@supabase/supabase-js'

const maxProfileAvatarBytes = 5 * 1024 * 1024
const acceptedProfileAvatarTypes = ['image/jpeg', 'image/png', 'image/webp'] as const

type ProfileAvatarValidationResult = { isValid: true } | { isValid: false; message: string }

/** 선택한 파일이 프로필 사진으로 저장할 수 있는 형식과 용량인지 반환한다. */
export function validateProfileAvatarFile(file: File): ProfileAvatarValidationResult {
  if (!acceptedProfileAvatarTypes.some((acceptedType) => acceptedType === file.type)) {
    return { isValid: false, message: 'JPG, PNG, WebP 형식의 사진만 올릴 수 있어요.' }
  }
  if (file.size > maxProfileAvatarBytes) {
    return { isValid: false, message: '사진은 5MB 이하만 올릴 수 있어요.' }
  }
  return { isValid: true }
}

/** 프로필 식별자로 private Storage에 저장할 고정 사진 경로를 반환한다. */
export function createProfileAvatarPath(profileId: string): string {
  return `profiles/${profileId}/avatar`
}

/** 검증된 사진 파일을 현재 사용자 전용 avatars Storage 경로에 덮어쓰고 경로를 반환한다. */
export async function uploadProfileAvatar(
  client: SupabaseClient,
  profileId: string,
  file: File,
): Promise<string> {
  const validation = validateProfileAvatarFile(file)
  if (!validation.isValid) throw new Error(validation.message)

  const path = createProfileAvatarPath(profileId)
  const response = await client.storage.from('avatars').upload(path, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: true,
  })
  if (response.error) throw response.error
  return response.data.path
}

/** private Storage 경로를 현재 사용자가 표시할 수 있는 짧은 서명 URL로 변환한다. */
export async function getProfileAvatarUrl(
  client: SupabaseClient,
  avatarPath: string | null,
): Promise<string | null> {
  if (!avatarPath) return null

  const response = await client.storage.from('avatars').createSignedUrl(avatarPath, 60 * 60)
  if (response.error) throw response.error
  return response.data.signedUrl
}
