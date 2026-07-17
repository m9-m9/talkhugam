import MuxPlayer from '@mux/mux-player-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'

import {
  deleteVideoPost,
  getVideoPlaybackAuthorization,
  getVideoPost,
  videoKeys,
} from '../../entities/video'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { LoadingSpinner } from '../../shared/ui/LoadingSpinner'

/** 영상 재생 화면 페이지 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
export function VideoPlayerPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { bookChatId, roomId, videoId } = useParams()
  const archivePath = `/rooms/${roomId ?? ''}/books/${bookChatId ?? ''}/videos`
  const videoQuery = useQuery({
    enabled: Boolean(bookChatId && videoId),
    queryFn: () => getVideoPost(createSupabaseClient(), bookChatId ?? '', videoId ?? ''),
    queryKey: videoKeys.byPost(videoId ?? ''),
  })
  const playbackQuery = useQuery({
    enabled: videoQuery.data?.status === 'ready',
    queryFn: () => getVideoPlaybackAuthorization(createSupabaseClient(), videoId ?? ''),
    queryKey: videoKeys.playback(videoId ?? ''),
    staleTime: 4 * 60 * 1_000,
  })
  const deleteMutation = useMutation({
    mutationFn: () => deleteVideoPost(createSupabaseClient(), videoId ?? ''),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: videoKeys.byBookChat(bookChatId ?? '') })
      void navigate(archivePath, { replace: true })
    },
  })

  /** 삭제 요청이나 사용자 동작을 처리한다. */
  function handleDelete() {
    if (!window.confirm('이 영상을 삭제할까요? 삭제 후 복구할 수 없어요.')) return
    deleteMutation.mutate()
  }

  if (!roomId || !bookChatId || !videoId) {
    return <main className="app-page bg-ink min-h-dvh px-0" />
  }

  return (
    <main className="app-page bg-ink flex min-h-dvh flex-col px-0">
      <header className="flex min-h-16 shrink-0 items-center border-b border-white/15 px-4 text-white">
        <button
          aria-label="영상 기록으로 돌아가기"
          className="focus-visible:ring-primary -ml-3 flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full focus-visible:ring-2 focus-visible:outline-none"
          onClick={() => void navigate(archivePath)}
          type="button"
        >
          <BackIcon />
        </button>
        <h1 className="flex-1 text-center text-base font-bold">영상 보기</h1>
        <button
          className="focus-visible:ring-primary min-h-11 cursor-pointer rounded-lg px-2 text-sm text-white/80 focus-visible:ring-2 focus-visible:outline-none"
          disabled={deleteMutation.isPending}
          onClick={handleDelete}
          type="button"
        >
          삭제
        </button>
      </header>
      <section
        className="relative flex min-h-0 flex-1 items-center justify-center"
        aria-label="영상 재생"
      >
        {videoQuery.isPending || playbackQuery.isPending ? (
          <LoadingSpinner label="영상을 준비하고 있어요." tone="inverse" />
        ) : playbackQuery.data ? (
          <MuxPlayer
            className="absolute inset-0 size-full"
            metadata={{ video_id: videoId, video_title: 'Talk후감 영상' }}
            playbackId={playbackQuery.data.playbackId}
            streamType="on-demand"
            tokens={{
              playback: playbackQuery.data.token,
              thumbnail: playbackQuery.data.thumbnailToken,
            }}
          />
        ) : (
          <div className="px-6 text-center">
            <p className="text-sm font-medium text-white">영상을 재생하지 못했어요.</p>
            <button
              className="text-primary mt-3 min-h-11 cursor-pointer px-3 text-sm font-medium"
              onClick={() => void playbackQuery.refetch()}
              type="button"
            >
              다시 시도
            </button>
          </div>
        )}
      </section>
    </main>
  )
}

/** 뒤로가기 아이콘 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
function BackIcon() {
  return (
    <svg aria-hidden="true" className="size-6" fill="none" viewBox="0 0 24 24">
      <path d="m14.5 5-7 7 7 7" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  )
}
