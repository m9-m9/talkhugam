import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import {
  createVideoUpload,
  getVideoDuration,
  getVideoUploadErrorMessage,
  uploadVideoFile,
  validateVideoDuration,
  videoKeys,
} from '../../entities/video'
import { readingRoomKeys } from '../../entities/reading-room'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { trackAnalyticsEvent } from '../../shared/analytics'

/** 영상 업로드 상태와 사용자 동작을 재사용 가능한 hook으로 제공한다. */
export function useVideoUpload(bookChatId: string | undefined) {
  const queryClient = useQueryClient()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isUploadingVideo, setIsUploadingVideo] = useState(false)

  /** 영상 데이터를 외부 저장소에 업로드한다. */
  async function uploadVideo(file: File | undefined) {
    if (!file || !bookChatId) return
    setErrorMessage(null)
    setIsUploadingVideo(true)
    try {
      if (!validateVideoDuration(await getVideoDuration(file))) {
        setErrorMessage('30초 이하의 영상만 올릴 수 있어요.')
        return
      }
      const upload = await createVideoUpload(createSupabaseClient(), bookChatId)
      trackAnalyticsEvent('video_upload_started')
      await refreshVideoPosts(bookChatId)
      await queryClient.invalidateQueries({ queryKey: readingRoomKeys.all })
      await uploadVideoFile(upload.uploadUrl, file)
      trackAnalyticsEvent('video_upload_ready')
      await refreshVideoPosts(bookChatId)
    } catch (error) {
      setErrorMessage(getVideoUploadErrorMessage(error))
    } finally {
      setIsUploadingVideo(false)
    }
  }

  /** 영상 업로드 뒤 관련 영상 목록 query를 다시 불러온다. */
  async function refreshVideoPosts(targetBookChatId: string) {
    await queryClient.invalidateQueries({ queryKey: videoKeys.byBookChat(targetBookChatId) })
  }

  return { errorMessage, isUploadingVideo, uploadVideo }
}
