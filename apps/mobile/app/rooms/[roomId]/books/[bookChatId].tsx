import { useLocalSearchParams, useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { z } from 'zod'

import { useMobileProtectedRoute } from '../../../../src/features/auth/useMobileProtectedRoute'
import { MobileBookDiscussionScreen } from '../../../../src/features/reading-room/MobileBookDiscussionScreen'
import { MobileRouteLoadingScreen } from '../../../../src/shared/ui/MobileRouteLoadingScreen'

/** 동적 경로 값 하나를 UUID로 제한해 잘못된 식별자가 서버 조회·후속 경로에 쓰이지 않게 한다. */
function parseRouteId(value: string | string[] | undefined): string | null {
  const result = z.string().uuid().safeParse(Array.isArray(value) ? undefined : value)
  return result.success ? result.data : null
}

/** 인증된 회원에게 경로의 책방·책 대화가 일치하는 텍스트 토론 화면을 표시한다. */
export default function BookChatRouteShell(): React.JSX.Element {
  const router = useRouter()
  const parameters = useLocalSearchParams<{
    bookChatId?: string | string[]
    roomId?: string | string[]
  }>()
  const roomId = parseRouteId(parameters.roomId)
  const bookChatId = parseRouteId(parameters.bookChatId)
  const isAllowed = useMobileProtectedRoute('/rooms')

  /** 잘못된 경로와 책 대화 화면 모두에서 회원의 책방 목록으로 안전하게 되돌아간다. */
  function handleBack(): void {
    router.replace('/rooms')
  }

  /** 현재 책 대화의 영상 기록 보관함으로 이동한다. */
  function handleOpenVideoArchive(): void {
    if (roomId === null || bookChatId === null) return
    router.push(`/rooms/${roomId}/books/${bookChatId}/videos`)
  }

  if (!isAllowed) return <MobileRouteLoadingScreen label="책 대화를 확인하고 있어요." />
  if (roomId === null || bookChatId === null) return <UnavailableBookChatRoute onBack={handleBack} />

  return <MobileBookDiscussionScreen bookChatId={bookChatId} onBack={handleBack} onOpenVideoArchive={handleOpenVideoArchive} roomId={roomId} />
}

/** 잘못된 책방·책 대화 식별자에서 서버 접근 없이 책방 목록 복귀를 안내한다. */
function UnavailableBookChatRoute({ onBack }: { onBack(): void }): React.JSX.Element {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>이 책 대화를 찾을 수 없어요</Text>
        <Text style={styles.description}>참여 중인 책방에서 다시 선택해 주세요.</Text>
        <Pressable
          accessibilityLabel="내 책방으로"
          accessibilityRole="button"
          onPress={onBack}
          style={styles.button}
        >
          <Text style={styles.buttonText}>내 책방으로</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: '#FF835F',
    borderRadius: 12,
    justifyContent: 'center',
    marginTop: 24,
    minHeight: 48,
    paddingHorizontal: 16,
  },
  buttonText: { color: '#000000', fontSize: 16, fontWeight: '700', lineHeight: 24 },
  container: { backgroundColor: '#000000', flex: 1, paddingHorizontal: 16 },
  content: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  description: {
    color: '#C7C7C7',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
    maxWidth: 280,
    textAlign: 'center',
  },
  title: { color: '#FFFFFF', fontSize: 22, fontWeight: '700', lineHeight: 30, textAlign: 'center' },
})
