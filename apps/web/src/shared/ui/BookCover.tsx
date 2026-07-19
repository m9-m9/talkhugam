import { useState } from 'react'

type BookCoverProps = {
  alt: string
  className?: string
  thumbnailUrl: string | null
}

/** 책 표지 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
export function BookCover({ alt, className, thumbnailUrl }: BookCoverProps) {
  const [hasImageError, setHasImageError] = useState(false)
  const shouldShowImage = thumbnailUrl !== null && !hasImageError

  if (shouldShowImage)
    return (
      <img
        alt={alt}
        className={`border-ink/10 h-16 w-12 shrink-0 rounded-sm border bg-white object-contain ${className ?? ''}`}
        onError={() => setHasImageError(true)}
        src={thumbnailUrl}
      />
    )

  return (
    <div
      aria-hidden="true"
      className={`bg-surface-muted text-primary flex h-16 w-12 shrink-0 items-center justify-center rounded-sm border border-transparent text-xs font-bold ${className ?? ''}`}
    >
      책
    </div>
  )
}
