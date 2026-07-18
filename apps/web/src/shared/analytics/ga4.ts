export const analyticsEventNames = [
  'login_completed',
  'onboarding_completed',
  'reading_room_created',
  'reading_room_joined',
  'book_chat_created',
  'post_created',
  'video_upload_started',
  'video_upload_ready',
  'book_completed',
  'feedback_submitted',
] as const

export type AnalyticsEventName = (typeof analyticsEventNames)[number]

type Gtag = (command: 'config' | 'event' | 'js', target: Date | string, parameters?: object) => void

declare global {
  interface Window {
    dataLayer?: unknown[][]
    gtag?: Gtag
  }
}

let activeMeasurementId: string | null = null

/** SPA 경로와 문서 제목에서 개인정보를 제외한 페이지 조회 payload를 만든다. */
export function createPageViewPayload(path: string, pageTitle: string) {
  const url = new URL(path, 'https://talkhugam.local')
  return { page_location: url.pathname, page_title: pageTitle }
}

/** 정해진 이벤트 이름에 개인정보·콘텐츠를 담지 않는 빈 분석 payload를 반환한다. */
export function createAnalyticsEventPayload(eventName: AnalyticsEventName): Record<string, never> {
  void eventName
  return {}
}

/** 전달받은 gtag에 자동 페이지 조회와 광고 기능을 끈 GA4 초기 설정을 보낸다. */
export function initializeGa4(measurementId: string, gtag: Gtag): void {
  gtag('js', new Date())
  gtag('config', measurementId, {
    allow_ad_personalization_signals: false,
    allow_google_signals: false,
    send_page_view: false,
  })
}

/** 공개 Measurement ID가 있을 때만 GA4 스크립트를 준비하고 초기 설정을 한 번 적용한다. */
export function loadGa4(measurementId: string | undefined): void {
  if (!measurementId || activeMeasurementId === measurementId) return

  const script = document.createElement('script')
  script.async = true
  script.id = 'talkhugam-ga4'
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`
  if (!document.getElementById(script.id)) document.head.append(script)

  const gtag = getOrCreateGtag()
  initializeGa4(measurementId, gtag)
  activeMeasurementId = measurementId
}

/** 현재 페이지를 GA4에 한 번 기록하며 검색어와 해시 값은 전송하지 않는다. */
export function trackPageView(path: string, pageTitle: string): void {
  if (!activeMeasurementId || !window.gtag) return
  window.gtag('event', 'page_view', createPageViewPayload(path, pageTitle))
}

/** 허용된 서비스 이용 이벤트만 GA4에 전송하고 사용자·콘텐츠 식별값은 제외한다. */
export function trackAnalyticsEvent(eventName: AnalyticsEventName): void {
  if (!activeMeasurementId || !window.gtag) return
  window.gtag('event', eventName, createAnalyticsEventPayload(eventName))
}

/** dataLayer를 보장하고 외부 스크립트 로드 전에도 명령을 큐에 저장할 gtag를 반환한다. */
function getOrCreateGtag(): Gtag {
  if (window.gtag) return window.gtag
  window.dataLayer ??= []
  window.gtag = (command, target, parameters) => {
    const args = parameters ? [command, target, parameters] : [command, target]
    window.dataLayer?.push(args)
  }
  return window.gtag
}
