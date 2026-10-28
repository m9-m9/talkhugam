import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native'

import { mobileRadius, mobileSpacing, mobileTouchTarget } from './mobileLayout'
import { mobileButtonStyles, mobileColors } from './mobileTheme'

export type MobileButtonVariant = 'primary' | 'neutral' | 'secondary' | 'ghost'

type MobileButtonProps = {
  accessibilityLabel?: string
  isDisabled?: boolean
  isLoading?: boolean
  label: string
  onPress(): void
  style?: StyleProp<ViewStyle>
  variant?: MobileButtonVariant
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
  ghostPressed: { backgroundColor: mobileColors.surfacePressed },
  ghostText: { color: mobileColors.inkSubtle },
  label: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
})

const variantStyles = {
  ghost: { base: styles.ghost, pressed: styles.ghostPressed, text: styles.ghostText },
  neutral: {
    base: mobileButtonStyles.neutral,
    pressed: mobileButtonStyles.neutralPressed,
    text: mobileButtonStyles.neutralText,
  },
  primary: {
    base: mobileButtonStyles.primary,
    pressed: mobileButtonStyles.primaryPressed,
    text: mobileButtonStyles.primaryText,
  },
  secondary: {
    base: mobileButtonStyles.secondary,
    pressed: mobileButtonStyles.secondaryPressed,
    text: mobileButtonStyles.secondaryText,
  },
}

/**
 * 모바일 공용 44px 버튼을 렌더링한다. 색은 `mobileButtonStyles` 토큰을 따른다:
 * primary는 화면의 주요 행동 하나(보내기 등, 코랄), neutral은 시트·모달 안의 확인(흰 면),
 * secondary는 보조 행동(테두리), ghost는 닫기·목록 토글처럼 가벼운 행동이다.
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
  const tone = variantStyles[variant]
  const isDisabledLook = isDisabled && variant !== 'ghost'
  const spinnerColor = variant === 'neutral' ? mobileColors.neutralActionText : mobileColors.ink
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ busy: isLoading, disabled: isInactive }}
      disabled={isInactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        tone.base,
        pressed && tone.pressed,
        isDisabledLook && mobileButtonStyles.disabled,
        style,
      ]}
    >
      {isLoading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <Text style={[styles.label, tone.text, isDisabledLook && mobileButtonStyles.disabledText]}>{label}</Text>
      )}
    </Pressable>
  )
}
