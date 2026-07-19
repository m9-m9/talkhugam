type ProfileAvatarProps = {
  alt: string
  displayName: string
  size?: 'md' | 'lg'
  src: string | null | undefined
}

/** 프로필 사진이 있으면 사진을, 없으면 이름 첫 글자를 원형 아바타로 렌더링한다. */
export function ProfileAvatar({ alt, displayName, size = 'md', src }: ProfileAvatarProps) {
  const sizeClassName = size === 'lg' ? 'size-24 text-3xl' : 'size-16 text-2xl'
  if (src) {
    return (
      <img
        alt={alt}
        className={`${sizeClassName} shrink-0 rounded-full border border-black/10 object-cover`}
        src={src}
      />
    )
  }

  return (
    <div
      aria-hidden="true"
      className={`bg-primary flex ${sizeClassName} shrink-0 items-center justify-center rounded-full font-semibold text-white`}
    >
      {displayName.slice(0, 1)}
    </div>
  )
}
