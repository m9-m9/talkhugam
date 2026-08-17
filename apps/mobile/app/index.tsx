import { StatusBar } from 'expo-status-bar'
import { StyleSheet, Text, View } from 'react-native'

/** 초기 네이티브 빌드에서 Talk후감 앱의 준비 상태를 사용자에게 안내한다. */
export default function WelcomeScreen(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Text style={styles.wordmark}>Talk후감</Text>
      <Text style={styles.message}>모바일 책방을 준비하고 있어요.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#FFF8F5',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  message: {
    color: '#6F625D',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 12,
  },
  wordmark: {
    color: '#EA6E5A',
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 40,
  },
})
