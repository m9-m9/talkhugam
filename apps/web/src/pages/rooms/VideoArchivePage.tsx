import MuxPlayer from '@mux/mux-player-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import {
  deleteVideoPost,
  getVideoPlaybackAuthorization,
  getVideoPosts,
  videoKeys,
  type VideoPost,
} from '../../entities/video'
import { useVideoUpload } from '../../features/video-upload'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { AppHeader } from '../../shared/ui/AppHeader'
import { LoadingSpinner } from '../../shared/ui/LoadingSpinner'

export function VideoArchivePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { bookChatId, roomId } = useParams()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { errorMessage, isUploadingVideo, uploadVideo } = useVideoUpload(bookChatId)
  const videosQuery = useQuery({
    enabled: Boolean(bookChatId),
    queryFn: () => getVideoPosts(createSupabaseClient(), bookChatId ?? ''),
    queryKey: videoKeys.byBookChat(bookChatId ?? ''),
    refetchInterval: (query) =>
      query.state.data?.some(
        (video) => video.status === 'waiting_upload' || video.status === 'processing',
      )
        ? 3_000
        : false,
  })
  const deleteMutation = useMutation({
    mutationFn: (postId: string) => deleteVideoPost(createSupabaseClient(), postId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: videoKeys.byBookChat(bookChatId ?? '') })
    },
  })

  function handleDelete(postId: string) {
    if (!window.confirm('이 영상을 삭제할까요? 삭제 후 복구할 수 없어요.')) return
    void deleteMutation.mutate(postId)
  }

  function handleSelectVideo(file: File | undefined) {
    void uploadVideo(file)
  }

  if (!roomId || !bookChatId) return <main className="app-page bg-surface min-h-screen" />

  return (
    <main className="app-page bg-surface px-4 pb-8">
      <AppHeader
        onBack={() => void navigate(`/rooms/${roomId}/books/${bookChatId}`)}
        title="영상 기록"
      />
      <header className="mt-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-ink text-xl font-bold">함께 남긴 독서 순간</h1>
          <p className="text-ink-subtle mt-2 text-sm">이 책을 읽으며 남긴 30초 영상이에요.</p>
        </div>
        <input
          accept="video/mp4,video/quicktime"
          aria-label="영상 파일 선택"
          className="sr-only"
          onChange={(event) => {
            handleSelectVideo(event.target.files?.[0])
            event.target.value = ''
          }}
          ref={fileInputRef}
          type="file"
        />
        <button
          aria-label="영상 올리기"
          className="bg-primary text-ink flex size-16 shrink-0 items-center justify-center rounded-full shadow-lg"
          disabled={isUploadingVideo}
          onClick={() => fileInputRef.current?.click()}
          type="button"
        >
          <svg aria-hidden="true" className="size-8" fill="none" viewBox="0 0 24 24">
            <path
              d="M12 5v14M5 12h14"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="2.8"
            />
          </svg>
        </button>
      </header>
      {errorMessage ? (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {isUploadingVideo ? <p className="text-ink-subtle mt-4 text-sm">영상을 올리고 있어요…</p> : null}
      {videosQuery.isPending ? (
        <div className="mt-12">
          <LoadingSpinner label="영상을 불러오고 있어요." />
        </div>
      ) : videosQuery.data?.length ? (
        <ul className="mt-8 space-y-4">
          {videosQuery.data.map((video) => (
            <li className="border-ink/10 overflow-hidden rounded-lg border bg-white" key={video.id}>
              <VideoCard
                isDeleting={deleteMutation.isPending}
                onDelete={handleDelete}
                video={video}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="bg-surface-muted mt-12 rounded-lg p-6 text-center">
          <p className="text-ink font-medium">아직 남겨진 영상이 없어요</p>
          <p className="text-ink-subtle mt-2 text-sm">채팅창의 + 버튼에서 첫 영상을 남겨 보세요.</p>
        </div>
      )}
    </main>
  )
}

function VideoCard({
  isDeleting,
  onDelete,
  video,
}: {
  isDeleting: boolean
  onDelete: (postId: string) => void
  video: VideoPost
}) {
  const playbackQuery = useQuery({
    enabled: video.status === 'ready',
    queryFn: () => getVideoPlaybackAuthorization(createSupabaseClient(), video.id),
    queryKey: ['video-playback', video.id],
    staleTime: 4 * 60 * 1_000,
  })

  return (
    <>
      {video.status === 'ready' && playbackQuery.data ? (
        <MuxPlayer
          className="aspect-video w-full"
          metadata={{ video_id: video.id, video_title: 'Talk후감 영상' }}
          playbackId={playbackQuery.data.playbackId}
          streamType="on-demand"
          thumbnailTime={0}
          tokens={{
            playback: playbackQuery.data.token,
            thumbnail: playbackQuery.data.thumbnailToken,
          }}
        />
      ) : (
        <VideoPlaceholder
          message={
            video.status === 'failed'
              ? '영상 처리에 실패했어요.'
              : playbackQuery.isError
                ? '재생 정보를 불러오지 못했어요.'
                : '영상 준비 중 · 대화는 계속할 수 있어요'
          }
        />
      )}
      <div className="flex items-start justify-between gap-4 p-4">
        <div>
          <p className="text-ink text-sm font-medium">{video.authorName}</p>
          {video.body ? <p className="text-ink-subtle mt-2 text-sm">{video.body}</p> : null}
        </div>
        <button
          className="text-ink-subtle min-h-11 px-2 text-xs"
          disabled={isDeleting}
          onClick={() => onDelete(video.id)}
          type="button"
        >
          삭제
        </button>
      </div>
    </>
  )
}

function VideoPlaceholder({ message }: { message: string }) {
  return (
    <div className="bg-ink flex aspect-video items-center justify-center px-4 text-center">
      <LoadingSpinner label={message} size="sm" tone="inverse" />
    </div>
  )
}
