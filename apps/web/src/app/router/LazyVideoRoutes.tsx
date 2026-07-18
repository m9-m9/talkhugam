import { lazy, Suspense } from 'react'

import { LoadingSpinner } from '../../shared/ui/LoadingSpinner'

const VideoArchivePage = lazy(async () => {
  const { VideoArchivePage: VideoArchivePageComponent } =
    await import('../../pages/rooms/VideoArchivePage')
  return { default: VideoArchivePageComponent }
})

const VideoPlayerPage = lazy(async () => {
  const { VideoPlayerPage: VideoPlayerPageComponent } =
    await import('../../pages/rooms/VideoPlayerPage')
  return { default: VideoPlayerPageComponent }
})

/** 영상 보관함 모듈을 불러오는 동안 공통 책 로더를 표시한 뒤 화면을 렌더링한다. */
export function LazyVideoArchiveRoute() {
  return (
    <Suspense fallback={<VideoRouteLoadingState label="영상 기록을 불러오고 있어요." />}>
      <VideoArchivePage />
    </Suspense>
  )
}

/** 영상 재생 모듈을 불러오는 동안 공통 책 로더를 표시한 뒤 화면을 렌더링한다. */
export function LazyVideoPlayerRoute() {
  return (
    <Suspense
      fallback={<VideoRouteLoadingState label="영상 보기를 불러오고 있어요." tone="inverse" />}
    >
      <VideoPlayerPage />
    </Suspense>
  )
}

/** 영상 전용 화면 모듈이 준비되기 전 배경과 톤에 맞는 로딩 상태를 렌더링한다. */
function VideoRouteLoadingState({
  label,
  tone = 'default',
}: {
  label: string
  tone?: 'default' | 'inverse'
}) {
  const backgroundClassName = tone === 'inverse' ? 'bg-ink' : 'bg-surface'

  return (
    <main
      className={`app-page ${backgroundClassName} flex min-h-dvh items-center justify-center px-4`}
    >
      <LoadingSpinner label={label} tone={tone} variant="book" />
    </main>
  )
}
