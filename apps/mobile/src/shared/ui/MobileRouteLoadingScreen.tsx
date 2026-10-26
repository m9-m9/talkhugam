import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { mobileColors } from './theme'

type MobileRouteLoadingScreenProps = {
  label: string
}

/** 보호된 화면의 접근 권한을 확인하는 동안 읽을 수 있는 진행 상태를 표시한다. */
export function MobileRouteLoadingScreen({
  label,
}: MobileRouteLoadingScreenProps): React.JSX.Element {
  return (
    <SafeAreaView style={styles.container}>
      <View accessibilityLabel={label} accessibilityRole="progressbar" style={styles.content}>
        <ActivityIndicator color={mobileColors.accent} />
        <Text style={styles.label}>{label}</Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { backgroundColor: mobileColors.surface, flex: 1, padding: 16 },
  content: { alignItems: 'center', flex: 1, gap: 12, justifyContent: 'center' },
  label: { color: mobileColors.inkSubtle, fontSize: 15, lineHeight: 22 },
})
