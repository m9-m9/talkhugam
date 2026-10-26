import { useLocalSearchParams, useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { z } from 'zod'

import { useMobileProtectedRoute } from '../../../../src/features/auth/useMobileProtectedRoute'
import { MobileBookDiscoveryScreen } from '../../../../src/features/reading-room/MobileBookDiscoveryScreen'
import { MobileRouteLoadingScreen } from '../../../../src/shared/ui/MobileRouteLoadingScreen'
import { mobileColors } from '../../../../src/shared/ui/theme'

/** 동적 경로 값을 UUID로 검증해 잘못된 책방에는 검색·생성 요청을 보내지 않는다. */
function parseRoomId(value: string | string[] | undefined): string | null {
  const result = z.string().uuid().safeParse(Array.isArray(value) ? undefined : value)
  return result.success ? result.data : null
}

/** 인증된 책방 멤버만 현재 책방에 새 책 대화를 만드는 화면을 연다. */
export default function BookDiscoveryRoute(): React.JSX.Element {
  const router = useRouter()
  const parameters = useLocalSearchParams<{ roomId?: string | string[] }>()
  const roomId = parseRoomId(parameters.roomId)
  const isAllowed = useMobileProtectedRoute('/rooms')

  /** 책 추가를 취소하면 현재 책방 상세로 안전하게 되돌아간다. */
  function handleBack(): void {
    if (roomId === null) {
      router.replace('/rooms')
      return
    }
    router.replace(`/rooms/${roomId}`)
  }

  /** 생성된 책 대화로 이동해 바로 멤버 전용 토론을 시작한다. */
  function handleOpenBookChat(bookChatId: string): void {
    if (roomId === null) return
    router.replace(`/rooms/${roomId}/books/${bookChatId}`)
  }

  if (!isAllowed) return <MobileRouteLoadingScreen label="책을 준비하고 있어요." />
  if (roomId === null) return <UnavailableRoomRoute onBack={handleBack} />

  return <MobileBookDiscoveryScreen onBack={handleBack} onOpenBookChat={handleOpenBookChat} roomId={roomId} />
}

/** 잘못된 책방 식별자에서는 서버 호출 없이 책방 목록 복귀를 안내한다. */
function UnavailableRoomRoute({ onBack }: { onBack(): void }): React.JSX.Element {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>이 책방을 찾을 수 없어요</Text>
        <Text style={styles.description}>참여 중인 책방에서 다시 선택해 주세요.</Text>
        <Pressable accessibilityLabel="내 책방으로" accessibilityRole="button" onPress={onBack} style={styles.button}>
          <Text style={styles.buttonText}>내 책방으로</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', backgroundColor: mobileColors.primaryAction, borderRadius: 12, justifyContent: 'center', marginTop: 24, minHeight: 48, paddingHorizontal: 16 },
  buttonText: { color: mobileColors.primaryActionText, fontSize: 16, fontWeight: '700', lineHeight: 24 },
  container: { backgroundColor: mobileColors.surface, flex: 1, paddingHorizontal: 16 },
  content: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  description: { color: mobileColors.inkSubtle, fontSize: 15, lineHeight: 22, marginTop: 12, maxWidth: 280, textAlign: 'center' },
  title: { color: mobileColors.ink, fontSize: 22, fontWeight: '700', lineHeight: 30, textAlign: 'center' },
})
