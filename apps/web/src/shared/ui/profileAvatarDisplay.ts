export type AvatarDisplayInput = {
  avatarPath?: string | null | undefined
  avatarUrl: string | null | undefined
  hasAvatarError?: boolean | undefined
}

export type AvatarDisplay = 'image' | 'initial' | 'placeholder'

/**
 * 사진 경로·임시 URL·오류 여부를 받아 무엇을 보여 줄지 정한다.
 * 경로가 없거나 불러오기에 실패하면 첫 글자, 경로는 있는데 URL을 기다리는 중이면 빈 자리, URL이 있으면 사진이다.
 */
export function resolveAvatarDisplay({
  avatarPath,
  avatarUrl,
  hasAvatarError,
}: AvatarDisplayInput): AvatarDisplay {
  if (hasAvatarError) return 'initial'
  if (avatarUrl) return 'image'
  if (avatarPath === null) return 'initial'
  if (avatarPath === undefined && avatarUrl === null) return 'initial'
  return 'placeholder'
}
