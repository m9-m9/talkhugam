type ProfileAvatarProps = {
  avatarUrl: string | null
  displayName: string
  size?: 'md' | 'lg'
}

/** 사진이 있으면 private 프로필 사진을, 없으면 이름 첫 글자를 원형 아바타로 렌더링한다. */
export function ProfileAvatar({ avatarUrl, displayName, size = 'lg' }: ProfileAvatarProps) {
  const sizeClassName = size === 'md' ? 'size-12 text-lg' : 'size-16 text-2xl'

  if (avatarUrl) {
    return (
      <img
        alt={`${displayName} 프로필 사진`}
        className={`${sizeClassName} shrink-0 rounded-full object-cover`}
        src={avatarUrl}
      />
    )
  }

  return (
    <div
      aria-hidden="true"
      className={`bg-ink text-surface flex ${sizeClassName} shrink-0 items-center justify-center rounded-full font-semibold`}
    >
      {displayName.slice(0, 1)}
    </div>
  )
}
