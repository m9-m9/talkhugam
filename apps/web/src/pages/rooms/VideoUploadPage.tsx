import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import MuxPlayer from '@mux/mux-player-react'

import {
  createVideoUpload,
  getVideoUploadErrorMessage,
  getVideoAsset,
  getVideoPlaybackAuthorization,
  uploadVideoFile,
  validateVideoDuration,
  videoKeys,
} from '../../entities/video'
import { createSupabaseClient } from '../../shared/api/supabaseClient'

export function VideoUploadPage() {
  const navigate = useNavigate()
  const { bookChatId, roomId } = useParams()
  const [postId, setPostId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const assetQuery = useQuery({
    enabled: Boolean(postId),
    queryFn: () => getVideoAsset(createSupabaseClient(), postId ?? ''),
    queryKey: videoKeys.byPost(postId ?? ''),
    refetchInterval: 3_000,
  })
  const playbackQuery = useQuery({
    enabled: assetQuery.data?.status === 'ready' && Boolean(postId),
    queryFn: () => getVideoPlaybackAuthorization(createSupabaseClient(), postId ?? ''),
    queryKey: ['video-playback', postId],
    staleTime: 4 * 60 * 1_000,
  })

  async function handleFile(file: File | undefined) {
    if (!file || !bookChatId) return
    setIsUploading(true)
    setErrorMessage(null)
    try {
      if (!validateVideoDuration(await getVideoDuration(file))) {
        setErrorMessage('30초 이하의 영상만 올릴 수 있어요.')
        return
      }
      const upload = await createVideoUpload(createSupabaseClient(), bookChatId)
      await uploadVideoFile(upload.uploadUrl, file)
      setPostId(upload.postId)
    } catch (error) {
      setErrorMessage(getVideoUploadErrorMessage(error))
    } finally {
      setIsUploading(false)
    }
  }

  if (!roomId || !bookChatId) return <main className="bg-surface min-h-screen" />

  return (
    <main className="bg-surface mx-auto min-h-screen w-full max-w-md px-6 py-8">
      <button
        className="text-ink-subtle -ml-3 min-h-11 px-3 text-sm"
        onClick={() => void navigate(-1)}
        type="button"
      >
        ← 뒤로
      </button>
      <h1 className="text-ink mt-3 text-xl font-bold">30초 순간 남기기</h1>
      <p className="text-ink-subtle mt-2 text-sm">짧은 영상으로 오늘의 책 순간을 남겨요.</p>
      <label className="border-ink/10 mt-12 flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed bg-white p-6 text-center">
        <span className="text-primary text-2xl">＋</span>
        <span className="text-ink mt-3 text-sm font-medium">영상 선택하기</span>
        <span className="text-ink-subtle mt-1 text-xs">30초 이하 · MP4, MOV</span>
        <input
          accept="video/mp4,video/quicktime"
          className="sr-only"
          disabled={isUploading || Boolean(postId)}
          onChange={(event) => void handleFile(event.target.files?.[0])}
          type="file"
        />
      </label>
      {errorMessage ? (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {isUploading ? (
        <p className="text-ink-subtle mt-6 text-sm" role="status">
          영상을 업로드하고 있어요…
        </p>
      ) : null}
      {postId ? (
        <VideoStatus
          onReturn={() => void navigate(`/rooms/${roomId}/books/${bookChatId}`)}
          playback={playbackQuery.data}
          playbackError={playbackQuery.isError}
          status={assetQuery.data?.status}
        />
      ) : null}
    </main>
  )
}

function VideoStatus({
  onReturn,
  playback,
  playbackError,
  status,
}: {
  onReturn: () => void
  playback: { playbackId: string; token: string } | undefined
  playbackError: boolean
  status: string | undefined
}) {
  if (status === 'ready')
    return (
      <section className="mt-6">
        <p className="text-primary text-sm font-medium">영상 준비가 완료됐어요.</p>
        {playback ? (
          <MuxPlayer
            className="mt-4 aspect-video w-full overflow-hidden rounded-lg"
            metadata={{ video_id: playback.playbackId, video_title: 'Talk후감 영상' }}
            playbackId={playback.playbackId}
            streamType="on-demand"
            tokens={{ playback: playback.token }}
          />
        ) : (
          <p className="text-ink-subtle mt-4 text-sm" role={playbackError ? 'alert' : 'status'}>
            {playbackError ? '영상을 재생하지 못했어요. 다시 열어 주세요.' : '재생 화면을 준비하고 있어요…'}
          </p>
        )}
        <button
          className="border-ink/10 text-ink mt-4 min-h-11 w-full rounded-md border bg-white text-sm font-semibold"
          onClick={onReturn}
          type="button"
        >
          책 대화로 돌아가기
        </button>
      </section>
    )
  if (status === 'failed')
    return <p className="mt-6 text-sm text-red-600">영상 처리에 실패했어요.</p>
  return (
    <section className="mt-6">
      <p className="text-ink-subtle text-sm" role="status">
        영상을 처리 중이에요. 대화로 돌아가도 처리는 계속돼요.
      </p>
      <button
        className="border-ink/10 text-ink mt-4 min-h-11 w-full rounded-md border bg-white text-sm font-semibold"
        onClick={onReturn}
        type="button"
      >
        책 대화로 돌아가기
      </button>
    </section>
  )
}
async function getVideoDuration(file: File): Promise<number> {
  const url = URL.createObjectURL(file)
  try {
    return await new Promise((resolve, reject) => {
      const video = document.createElement('video')
      video.onloadedmetadata = () => resolve(video.duration)
      video.onerror = () => reject(new Error('metadata'))
      video.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}
