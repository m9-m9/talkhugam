import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native'

import { mobileColors, mobileRadius, mobileSpacing, mobileTouchTarget } from './mobileTheme'

export type MobileButtonVariant = 'primary' | 'secondary' | 'ghost'

type MobileButtonProps = {
  accessibilityLabel?: string
  isDisabled?: boolean
  isLoading?: boolean
  label: string
  onPress(): void
  style?: StyleProp<ViewStyle>
  variant?: MobileButtonVariant
}

/**
 * 모바일 공용 44px 버튼을 렌더링한다. primary는 화면의 주요 행동 하나(Action 면·흰 글자),
 * secondary는 보조 행동(테두리), ghost는 시트 닫기·목록 토글처럼 가벼운 행동이다. 색은 토큰만 쓴다.
 */
export function MobileButton({
  accessibilityLabel,
  isDisabled = false,
  isLoading = false,
  label,
  onPress,
  style,
  variant = 'secondary',
}: MobileButtonProps): React.JSX.Element {
  const isInactive = isDisabled || isLoading
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ busy: isLoading, disabled: isInactive }}
      disabled={isInactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && styles.pressed,
        isInactive && styles.inactive,
        style,
      ]}
    >
      {isLoading ? (
        <ActivityIndicator color={mobileColors.ink} />
      ) : (
        <Text style={[styles.label, variant === 'ghost' && styles.ghostLabel]}>{label}</Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderRadius: mobileRadius.md,
    justifyContent: 'center',
    minHeight: mobileTouchTarget,
    minWidth: mobileTouchTarget,
    paddingHorizontal: mobileSpacing.sm,
  },
  ghost: { backgroundColor: 'transparent' },
  ghostLabel: { color: mobileColors.inkSubtle },
  inactive: { opacity: 0.4 },
  label: { color: mobileColors.ink, fontSize: 15, fontWeight: '600', lineHeight: 20 },
  pressed: { opacity: 0.7 },
  primary: { backgroundColor: mobileColors.action },
  secondary: {
    backgroundColor: mobileColors.surfaceRaised,
    borderColor: mobileColors.border,
    borderWidth: 1,
  },
})
