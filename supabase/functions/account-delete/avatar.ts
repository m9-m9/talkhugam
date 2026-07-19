type ProfileAvatarStorageClient = {
  storage: {
    from: (bucketName: string) => {
      remove: (paths: string[]) => Promise<{ error: unknown | null }>
    }
  }
}

/** 계정 식별자에 해당하는 private 프로필 사진을 Storage API로 삭제하고 성공 여부를 반환한다. */
export async function deleteProfileAvatar(
  client: ProfileAvatarStorageClient,
  profileId: string,
): Promise<boolean> {
  const response = await client.storage
    .from('avatars')
    .remove([`profiles/${profileId}/avatar`])
  return response.error === null
}
