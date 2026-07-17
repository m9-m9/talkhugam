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

export function useVideoUpload(bookChatId: string | undefined) {
  const queryClient = useQueryClient()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isUploadingVideo, setIsUploadingVideo] = useState(false)

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
      await refreshVideoPosts(bookChatId)
      await queryClient.invalidateQueries({ queryKey: readingRoomKeys.all })
      await uploadVideoFile(upload.uploadUrl, file)
      await refreshVideoPosts(bookChatId)
    } catch (error) {
      setErrorMessage(getVideoUploadErrorMessage(error))
    } finally {
      setIsUploadingVideo(false)
    }
  }

  async function refreshVideoPosts(targetBookChatId: string) {
    await queryClient.invalidateQueries({ queryKey: videoKeys.byBookChat(targetBookChatId) })
  }

  return { errorMessage, isUploadingVideo, uploadVideo }
}
