import { useState } from 'react'

import { resolveAvatarDisplay } from './profileAvatarDisplay'

type ProfileAvatarProps = {
  /** 프로필에 저장된 사진 경로. `undefined`는 프로필을 아직 모르는 상태, `null`은 사진 없음이다. */
  avatarPath?: string | null | undefined
  avatarUrl: string | null | undefined
  displayName: string
  hasAvatarError?: boolean
  size?: 'md' | 'lg'
}

const sizeClassNames = {
  lg: 'size-16 text-2xl',
  md: 'size-12 text-lg',
} as const

/**
 * 프로필 사진을 크기가 고정된 원 안에 렌더링한다. 사진이 있는 사람에게 첫 글자가 먼저 보였다가
 * 사진으로 바뀌지 않도록, 사진을 기다리는 동안은 빈 표면 원을 두고 이미지가 다 불러와진 뒤 서서히 보여 준다.
 */
export function ProfileAvatar({
  avatarPath,
  avatarUrl,
  displayName,
  hasAvatarError = false,
  size = 'lg',
}: ProfileAvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const hasImageFailed = Boolean(avatarUrl) && failedUrl === avatarUrl
  const display = resolveAvatarDisplay({
    avatarPath,
    avatarUrl,
    hasAvatarError: hasAvatarError || hasImageFailed,
  })
  const sizeClassName = sizeClassNames[size]

  return (
    <div
      className={`bg-surface-raised border-border text-ink relative flex ${sizeClassName} shrink-0 items-center justify-center overflow-hidden rounded-full border font-semibold`}
      data-avatar-state={display}
      data-testid="profile-avatar"
    >
      {display === 'initial' ? <span aria-hidden="true">{displayName.slice(0, 1)}</span> : null}
      {display === 'image' && avatarUrl ? (
        <AvatarImage
          displayName={displayName}
          key={avatarUrl}
          onError={() => setFailedUrl(avatarUrl)}
          src={avatarUrl}
        />
      ) : null}
    </div>
  )
}

type AvatarImageProps = {
  displayName: string
  onError: () => void
  src: string
}

/** 이미지가 다 불러와질 때까지 투명하게 두었다가 짧은 opacity 전환으로 보여 준다. */
function AvatarImage({ displayName, onError, src }: AvatarImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)

  return (
    <img
      alt={`${displayName} 프로필 사진`}
      className={`absolute inset-0 size-full object-cover transition-opacity duration-150 motion-reduce:transition-none ${
        isLoaded ? 'opacity-100' : 'opacity-0'
      }`}
      decoding="async"
      onError={onError}
      onLoad={() => setIsLoaded(true)}
      src={src}
    />
  )
}
