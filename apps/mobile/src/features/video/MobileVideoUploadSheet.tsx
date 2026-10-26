import { useQueryClient } from '@tanstack/react-query'
import { readingRoomKeys, videoKeys } from '@talkhugam/domain'
import { File } from 'expo-file-system'
import * as ImagePicker from 'expo-image-picker'
import { useRef, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

import { createMobileVideoUpload } from '../../entities/video'
import { createMobileSupabaseClient } from '../../shared/api/mobileSupabaseClient'
import { parseSelectedNativeVideo, type SelectedNativeVideo } from './nativeVideoUpload'
import { mobileColors } from '../../shared/ui/theme'

type MobileVideoUploadSheetProps = { bookChatId: string; onClose(): void; roomId: string }
type FailedUpload = { clientId: string; video: SelectedNativeVideo }

/** 카메라·갤러리에서 고른 짧은 영상을 Mux 직접 업로드로 전송하는 하단 시트를 표시한다. */
export function MobileVideoUploadSheet({ bookChatId, onClose, roomId }: MobileVideoUploadSheetProps): React.JSX.Element {
  const queryClient = useQueryClient()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [failedUpload, setFailedUpload] = useState<FailedUpload | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const uploadLockedRef = useRef(false)

  /** 카메라 또는 사진 보관함 권한과 선택 결과를 검사해 업로드를 시작한다. */
  async function handlePickVideo(source: 'camera' | 'library'): Promise<void> {
    if (isUploading || uploadLockedRef.current) return
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      setErrorMessage(source === 'camera' ? '카메라 권한을 허용해 주세요.' : '사진 보관함 권한을 허용해 주세요.')
      return
    }
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['videos'], videoMaxDuration: 30 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'] })
    if (result.canceled) return
    const asset = result.assets[0]
    if (!asset) return
    try {
      const video = parseSelectedNativeVideo({ duration: asset.duration, mimeType: asset.mimeType, uri: asset.uri })
      await uploadVideo({ clientId: crypto.randomUUID(), video })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '영상을 올리지 못했어요. 다시 시도해 주세요.')
    }
  }

  /** 같은 clientId를 유지해 영상 post 중복 없이 Mux 업로드 생성과 native PUT을 실행한다. */
  async function uploadVideo(upload: FailedUpload): Promise<void> {
    if (uploadLockedRef.current) return
    uploadLockedRef.current = true
    setIsUploading(true)
    setErrorMessage(null)
    try {
      const created = await createMobileVideoUpload(createMobileSupabaseClient(), bookChatId, upload.clientId)
      const result = await new File(upload.video.uri).upload(created.uploadUrl, {
        headers: { 'content-type': upload.video.mimeType },
        httpMethod: 'PUT',
        mimeType: upload.video.mimeType,
      })
      if (result.status < 200 || result.status >= 300) throw new Error('영상 업로드에 실패했어요. 다시 시도해 주세요.')
      setFailedUpload(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: videoKeys.byBookChat(bookChatId) }),
        queryClient.invalidateQueries({ queryKey: readingRoomKeys.all }),
      ])
      onClose()
    } catch (error) {
      setFailedUpload(upload)
      setErrorMessage(error instanceof Error ? error.message : '영상을 올리지 못했어요. 다시 시도해 주세요.')
    } finally {
      uploadLockedRef.current = false
      setIsUploading(false)
    }
  }

  /** 실패한 업로드를 같은 idempotency key와 파일 URI로 재실행한다. */
  function handleRetry(): void {
    if (failedUpload) void uploadVideo(failedUpload)
  }

  return <View accessibilityLabel="영상 업로드 시트" accessibilityViewIsModal style={styles.backdrop}><View style={styles.sheet}><Text style={styles.title}>영상 추가</Text><Text style={styles.description}>30초 이하의 MP4 또는 MOV 영상을 올릴 수 있어요.</Text>{errorMessage ? <Text accessibilityRole="alert" style={styles.error}>{errorMessage}</Text> : null}<Pressable accessibilityLabel="카메라로 영상 촬영" accessibilityRole="button" disabled={isUploading} onPress={() => void handlePickVideo('camera')} style={styles.primary}>{isUploading ? <ActivityIndicator color="#000000" /> : <Text style={styles.primaryText}>카메라로 촬영</Text>}</Pressable><Pressable accessibilityLabel="갤러리에서 영상 선택" accessibilityRole="button" disabled={isUploading} onPress={() => void handlePickVideo('library')} style={styles.secondary}><Text style={styles.secondaryText}>갤러리에서 선택</Text></Pressable>{failedUpload ? <Pressable accessibilityLabel="영상 업로드 다시 시도" accessibilityRole="button" disabled={isUploading} onPress={handleRetry} style={styles.secondary}><Text style={styles.secondaryText}>다시 시도</Text></Pressable> : null}<Pressable accessibilityLabel="영상 업로드 닫기" accessibilityRole="button" disabled={isUploading} onPress={onClose} style={styles.close}><Text style={styles.closeText}>닫기</Text></Pressable></View></View>
}

const styles = StyleSheet.create({ backdrop: { backgroundColor: 'rgba(0,0,0,0.7)', bottom: 0, justifyContent: 'flex-end', left: 0, position: 'absolute', right: 0, top: 0 }, close: { alignItems: 'center', justifyContent: 'center', minHeight: 44 }, closeText: { color: mobileColors.inkSubtle, fontWeight: '700' }, description: { color: mobileColors.inkSubtle, lineHeight: 20 }, error: { color: mobileColors.danger, lineHeight: 20 }, primary: { alignItems: 'center', backgroundColor: mobileColors.primaryAction, borderRadius: 12, justifyContent: 'center', minHeight: 48 }, primaryText: { color: mobileColors.primaryActionText, fontWeight: '700' }, secondary: { alignItems: 'center', borderColor: mobileColors.borderStrong, borderRadius: 12, borderWidth: 1, justifyContent: 'center', minHeight: 48 }, secondaryText: { color: mobileColors.ink, fontWeight: '700' }, sheet: { backgroundColor: mobileColors.surfaceRaised, borderTopLeftRadius: 20, borderTopRightRadius: 20, gap: 12, padding: 16, paddingBottom: 28 }, title: { color: mobileColors.ink, fontSize: 20, fontWeight: '700' } })
