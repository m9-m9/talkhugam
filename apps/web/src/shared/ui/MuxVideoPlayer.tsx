import MuxPlayer from '@mux/mux-player-react'

type MuxVideoPlayerProps = {
  className: string
  metadata: {
    videoId: string
    videoTitle: string
  }
  playbackId: string
  thumbnailTime?: number
  tokens: {
    playback: string
    thumbnail: string
  }
}

/** Mux 재생 식별자와 서명 토큰을 받아 공통 영상 플레이어를 렌더링한다. */
export default function MuxVideoPlayer({
  className,
  metadata,
  playbackId,
  thumbnailTime,
  tokens,
}: MuxVideoPlayerProps) {
  return (
    <MuxPlayer
      className={className}
      metadata={{ video_id: metadata.videoId, video_title: metadata.videoTitle }}
      playbackId={playbackId}
      streamType="on-demand"
      tokens={tokens}
      {...(thumbnailTime === undefined ? {} : { thumbnailTime })}
    />
  )
}
