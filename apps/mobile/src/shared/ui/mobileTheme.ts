/**
 * design.md 기본 팔레트를 모바일 화면에서 쓰는 색 토큰. 값의 정본은 웹 `globals.css`의 `@theme`이며,
 * 새 모바일 화면은 색을 직접 적지 않고 이 토큰만 쓴다.
 */
export const mobileColors = {
  accent: '#FF835F',
  accentText: '#FFB59C',
  action: '#AD3D22',
  border: '#2A2A2A',
  danger: '#FF6B6B',
  dangerAction: '#C4302B',
  ink: '#FFFFFF',
  inkSubtle: '#C7C7C7',
  /** 사진 위 줄 박스: Ink를 10%·30% 면, 40% 테두리로 겹친다(웹 `bg-ink/10`·`bg-ink/30`·`ring-ink/40`과 같다). */
  inkOverlay: 'rgba(255, 255, 255, 0.1)',
  inkOverlayBorder: 'rgba(255, 255, 255, 0.4)',
  inkOverlayStrong: 'rgba(255, 255, 255, 0.3)',
  /** 시트·전체 화면 뒤를 가리는 반투명 검정. Surface를 72% 불투명도로 쓴다. */
  scrim: 'rgba(0, 0, 0, 0.72)',
  surface: '#000000',
  surfaceRaised: '#101010',
} as const

/** Foundation spacing scale(0/4/8/12/16/24/32/40/48/64) 중 모바일에서 자주 쓰는 값. */
export const mobileSpacing = { lg: 24, md: 16, sm: 12, xs: 8, xxs: 4 } as const

/** 기본 radius(8px)와 시트용 큰 radius. */
export const mobileRadius = { md: 8, sheet: 16 } as const

/** 터치 대상 최소 크기(44px). */
export const mobileTouchTarget = 44
