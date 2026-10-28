import { Pressable, StyleSheet, Text } from 'react-native'

import { mobileColors } from './mobileTheme'

type MobileBackButtonProps = {
  accessibilityLabel?: string
  label?: string
  onPress(): void
}

/** 헤더를 끈 화면에서도 같은 자리·크기(44px)로 보이는 뒤로가기 버튼을 그린다. */
export function MobileBackButton({
  accessibilityLabel = '이전 화면으로 돌아가기',
  label = '이전',
  onPress,
}: MobileBackButtonProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: { alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44, minWidth: 44 },
  label: { color: mobileColors.ink, fontSize: 15, fontWeight: '600', lineHeight: 22 },
  pressed: { opacity: 0.6 },
})
