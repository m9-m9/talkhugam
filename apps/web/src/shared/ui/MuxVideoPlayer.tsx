import MuxPlayer from '@mux/mux-player-react'

type MuxVideoPlayerProps = {
  autoPlay?: boolean
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
}

/** Mux 재생 식별자와 서명 토큰을 받아 공통 영상 플레이어를 렌더링한다. */
export default function MuxVideoPlayer({
  autoPlay,
  className,
  metadata,
  onPlaybackError,
  playbackId,
  thumbnailTime,
  tokens,
}: MuxVideoPlayerProps) {
  /** Mux가 전달한 미디어 오류 이벤트를 화면 단위 오류 처리로 변환한다. */
  function handlePlaybackError() {
    onPlaybackError?.()
  }

  return (
    <MuxPlayer
      {...(autoPlay === undefined ? {} : { autoPlay })}
      className={className}
      metadata={{ video_id: metadata.videoId, video_title: metadata.videoTitle }}
      playbackId={playbackId}
      streamType="on-demand"
      tokens={tokens}
      {...(onPlaybackError === undefined ? {} : { onError: handlePlaybackError })}
      {...(thumbnailTime === undefined ? {} : { thumbnailTime })}
    />
  )
}
