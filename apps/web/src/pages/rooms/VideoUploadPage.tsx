import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import {
  createVideoUpload,
  getVideoAsset,
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
    } catch {
      setErrorMessage('영상 업로드를 시작하지 못했어요. 잠시 후 다시 시도해 주세요.')
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
      {postId ? <VideoStatus status={assetQuery.data?.status} /> : null}
    </main>
  )
}

function VideoStatus({ status }: { status: string | undefined }) {
  if (status === 'ready')
    return <p className="text-primary mt-6 text-sm font-medium">영상 준비가 완료됐어요.</p>
  if (status === 'failed')
    return <p className="mt-6 text-sm text-red-600">영상 처리에 실패했어요.</p>
  return (
    <p className="text-ink-subtle mt-6 text-sm" role="status">
      영상 처리 중이에요. 잠시만 기다려 주세요.
    </p>
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
