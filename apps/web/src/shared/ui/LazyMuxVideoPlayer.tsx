import { lazy, Suspense } from 'react'

import { BookLoadingIndicator } from './LoadingSpinner'

const MuxVideoPlayer = lazy(() => import('./MuxVideoPlayer'))

type LazyMuxVideoPlayerProps = {
  className: string
  metadata: {
    videoId: string
    videoTitle: string
  }
  playbackId: string
  onPlaybackError?: () => void
  thumbnailTime?: number
  tokens: {
    playback: string
    thumbnail: string
  }
  tone?: 'default' | 'inverse'
}

/** 실제 재생이 필요한 순간에만 Mux 재생기를 불러오고 대기 상태를 안내한다. */
export function LazyMuxVideoPlayer({
  className,
  metadata,
  onPlaybackError,
  playbackId,
  thumbnailTime,
  tokens,
  tone = 'default',
}: LazyMuxVideoPlayerProps) {
  return (
    <Suspense
      fallback={
        <div className={`${className} flex items-center justify-center`}>
          <BookLoadingIndicator label="재생기를 불러오고 있어요." size="sm" tone={tone} />
        </div>
      }
    >
      <MuxVideoPlayer
        className={className}
        metadata={metadata}
        playbackId={playbackId}
        tokens={tokens}
        {...(onPlaybackError === undefined ? {} : { onPlaybackError })}
        {...(thumbnailTime === undefined ? {} : { thumbnailTime })}
      />
    </Suspense>
  )
}
