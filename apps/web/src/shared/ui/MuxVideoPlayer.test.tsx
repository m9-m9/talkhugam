import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import MuxVideoPlayer from './MuxVideoPlayer'

const renderMuxPlayer = vi.fn()

vi.mock('@mux/mux-player-react', () => ({
  default: ({ onError, playbackId }: { onError?: () => void; playbackId: string }) => {
    renderMuxPlayer({ onError, playbackId })
    return <button data-testid="mux-player" onClick={onError} type="button" />
  },
}))

describe('MuxVideoPlayer', () => {
  it('passes the playback identity and media error callback to the Mux player', () => {
    const onPlaybackError = vi.fn()
    render(
      <MuxVideoPlayer
        className="aspect-video"
        metadata={{ videoId: 'video-1', videoTitle: 'Talk후감 영상' }}
        onPlaybackError={onPlaybackError}
        playbackId="playback-id"
        tokens={{ playback: 'playback-token', thumbnail: 'thumbnail-token' }}
      />,
    )

    expect(renderMuxPlayer).toHaveBeenCalledWith(
      expect.objectContaining({ playbackId: 'playback-id' }),
    )
    fireEvent.click(screen.getByTestId('mux-player'))
    expect(onPlaybackError).toHaveBeenCalledOnce()
  })
})
