import { StyleSheet } from 'react-native'

/**
 * 웹 `globals.css`의 다크 토큰과 같은 값을 모바일 화면에 제공한다.
 * 코랄(`accent`·`accentText`·`action`)은 `design.md`「코랄 규칙」의 세 자리
 * (보내기 버튼 활성, 브랜드 표시, 작은 신호)에만 쓴다.
 */
export const mobileColors = {
  accent: '#FF835F',
  accentText: '#FFB59C',
  action: '#AD3D22',
  border: '#2A2A2A',
  borderStrong: '#393939',
  danger: '#FF6B6B',
  dangerAction: '#C4302B',
  ink: '#FFFFFF',
  inkSubtle: '#C7C7C7',
  placeholder: '#8D8D8D',
  primaryAction: '#FFFFFF',
  primaryActionPressed: '#DBDBDB',
  primaryActionText: '#000000',
  surface: '#000000',
  surfacePressed: '#1B1B1B',
  surfaceRaised: '#101010',
  switchTrackOff: '#4A4A4A',
} as const

/** 주요·보조·위험 버튼의 공용 모양. 화면은 여기에 크기·여백만 더한다. */
export const mobileButtonStyles = StyleSheet.create({
  danger: { backgroundColor: mobileColors.dangerAction, borderColor: mobileColors.dangerAction },
  dangerText: { color: mobileColors.ink },
  disabled: {
    backgroundColor: mobileColors.surfaceRaised,
    borderColor: mobileColors.border,
    borderWidth: 1,
  },
  disabledText: { color: mobileColors.inkSubtle },
  primary: { backgroundColor: mobileColors.primaryAction },
  primaryPressed: { backgroundColor: mobileColors.primaryActionPressed },
  primaryText: { color: mobileColors.primaryActionText },
  secondary: {
    backgroundColor: mobileColors.surfaceRaised,
    borderColor: mobileColors.borderStrong,
    borderWidth: 1,
  },
  secondaryPressed: { backgroundColor: mobileColors.surfacePressed },
  secondaryText: { color: mobileColors.ink },
})
