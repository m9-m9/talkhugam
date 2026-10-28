/** 서명 URL 유효 시간(1시간)보다 짧게 캐시해, 화면을 오갈 때마다 새 URL로 사진을 다시 받지 않게 한다. */
export const profileAvatarUrlStaleTime = 50 * 60 * 1000

/** 프로필 사진 임시 URL 조회의 공용 Query key를 프로필·사진 경로·수정 시각으로 만든다. */
export function createProfileAvatarUrlQueryKey(
  profileId: string | null | undefined,
  avatarPath: string | null | undefined,
  updatedAt: string | null | undefined,
) {
  return [...createProfileAvatarUrlQueryPrefix(profileId), avatarPath, updatedAt] as const
}

/** 한 프로필의 사진 임시 URL 캐시를 모두 무효화할 때 쓰는 Query key 앞부분을 만든다. */
export function createProfileAvatarUrlQueryPrefix(profileId: string | null | undefined) {
  return ['profile-avatar-url', profileId] as const
}
