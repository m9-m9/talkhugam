import { StyleSheet } from 'react-native'

/**
 * 웹 `globals.css`의 다크 토큰과 같은 값을 모바일 화면에 제공한다.
 * 코랄(`accent`·`accentSoft`·`accentText`·`action`)은 `design.md`「코랄 규칙」대로
 * 화면의 주요 행동 하나, 선택 상태, 브랜드, 별점 같은 핵심 콘텐츠에만 쓴다.
 * 시트·모달 안의 확인 버튼은 `neutralAction`(흰 면)을 쓴다.
 */
export const mobileColors = {
  accent: '#FF835F',
  accentSoft: '#3A231C',
  accentText: '#FFB59C',
  action: '#AD3D22',
  border: '#3A3633',
  borderStrong: '#4A4542',
  danger: '#FF6B6B',
  dangerAction: '#C4302B',
  ink: '#FFFFFF',
  inkSubtle: '#C9C5C2',
  neutralAction: '#FFFFFF',
  neutralActionPressed: '#DBDBDB',
  neutralActionText: '#141312',
  placeholder: '#9A9591',
  primaryAction: '#AD3D22',
  primaryActionPressed: '#B95A43',
  primaryActionText: '#FFFFFF',
  surface: '#141312',
  surfacePressed: '#292624',
  surfaceRaised: '#1F1D1C',
  switchTrackOff: '#4A4542',
} as const

/** 주요(코랄)·흰 면·보조·위험 버튼의 공용 모양. 화면은 여기에 크기·여백만 더한다. */
export const mobileButtonStyles = StyleSheet.create({
  danger: { backgroundColor: mobileColors.dangerAction, borderColor: mobileColors.dangerAction },
  dangerText: { color: mobileColors.ink },
  disabled: {
    backgroundColor: mobileColors.surfaceRaised,
    borderColor: mobileColors.border,
    borderWidth: 1,
  },
  disabledText: { color: mobileColors.inkSubtle },
  neutral: { backgroundColor: mobileColors.neutralAction },
  neutralPressed: { backgroundColor: mobileColors.neutralActionPressed },
  neutralText: { color: mobileColors.neutralActionText },
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
