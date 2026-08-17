import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useMobileProtectedRoute } from '../src/features/auth/useMobileProtectedRoute'
import { MobileRouteLoadingScreen } from '../src/shared/ui/MobileRouteLoadingScreen'

/** 인증과 필수 동의를 마친 새 회원에게 연결될 온보딩 경로 셸을 표시한다. */
export default function OnboardingRoute(): React.JSX.Element {
  const isAllowed = useMobileProtectedRoute('/onboarding')

  if (!isAllowed) return <MobileRouteLoadingScreen label="계정 정보를 확인하고 있어요." />

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>Talk후감 시작하기</Text>
        <Text style={styles.title}>프로필을 준비하고 있어요</Text>
        <Text style={styles.description}>
          온보딩 입력 화면은 다음 모바일 동등성 작업에서 이어집니다.
        </Text>
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
