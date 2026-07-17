import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import {
  createVideoUpload,
  getVideoUploadErrorMessage,
  uploadVideoFile,
  validateVideoDuration,
} from '../../entities/video'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { LoadingSpinner } from '../../shared/ui/LoadingSpinner'

export function VideoUploadPage() {
  const navigate = useNavigate()
  const { bookChatId, roomId } = useParams()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

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
      void navigate(`/rooms/${roomId}/books/${bookChatId}`, {
        replace: true,
        state: { uploadedVideoPostId: upload.postId },
      })
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
          disabled={isUploading}
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
        <div className="mt-6">
          <LoadingSpinner label="영상을 독서방에 남기고 있어요…" />
        </div>
      ) : null}
    </main>
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
