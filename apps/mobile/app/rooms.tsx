import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useMobileProtectedRoute } from '../src/features/auth/useMobileProtectedRoute'
import { MobileRouteLoadingScreen } from '../src/shared/ui/MobileRouteLoadingScreen'

/** 인증·약관·온보딩을 완료한 회원에게 연결될 내 책방 경로 셸을 표시한다. */
export default function RoomsRoute(): React.JSX.Element {
  const isAllowed = useMobileProtectedRoute('/rooms')

  if (!isAllowed) return <MobileRouteLoadingScreen label="책방을 불러오고 있어요." />

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>내 책방</Text>
        <Text style={styles.title}>함께 읽은 이야기를 모아 볼까요?</Text>
        <Text style={styles.description}>책방 목록은 다음 모바일 동등성 작업에서 연결합니다.</Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#FFF8F5', flex: 1, padding: 16 },
  content: { flex: 1, justifyContent: 'center' },
  description: { color: '#645954', fontSize: 16, lineHeight: 24, marginTop: 16 },
  eyebrow: { color: '#AD3D22', fontSize: 14, fontWeight: '700', lineHeight: 20 },
  title: { color: '#241C19', fontSize: 28, fontWeight: '700', lineHeight: 38, marginTop: 8 },
})
