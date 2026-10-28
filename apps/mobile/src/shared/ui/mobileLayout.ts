/** Foundation spacing scale(0/4/8/12/16/24/32/40/48/64) 중 모바일에서 자주 쓰는 값. */
export const mobileSpacing = { lg: 24, md: 16, sm: 12, xs: 8, xxs: 4 } as const

/** 기본 radius(8px)와 시트용 큰 radius. */
export const mobileRadius = { md: 8, sheet: 16 } as const

/** 터치 대상 최소 크기(44px). */
export const mobileTouchTarget = 44

/**
 * `#RRGGBB` 색 토큰과 0~1 불투명도를 받아 `#RRGGBBAA` 색을 반환한다.
 * 시트 뒤 가림막·사진 위 줄 박스처럼 토큰을 반투명으로 겹칠 때 쓴다.
 */
export function withAlpha(hexColor: string, alpha: number): string {
  const channel = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
  return `${hexColor.slice(0, 7)}${channel.toString(16).padStart(2, '0').toUpperCase()}`
}
