import type { InviteSharePlatform } from './InviteShareSheet'

export type InviteShareData = {
  text: string
  title: string
  url: string
}

type InviteValue = {
  code: string
  token: string
}

type ClipboardApi = Pick<Clipboard, 'writeText'>

type DocumentApi = Pick<Document, 'createElement' | 'execCommand'> & {
  body: Pick<HTMLBodyElement, 'appendChild' | 'removeChild'>
}

type KakaoShareSdk = {
  Share: {
    sendDefault: (template: KakaoTextTemplate) => void
  }
  init: (javascriptKey: string) => void
  isInitialized: () => boolean
}

type KakaoTextTemplate = {
  link: {
    mobileWebUrl: string
    webUrl: string
  }
  objectType: 'text'
  text: string
}

type KakaoSdkLoader = () => Promise<KakaoShareSdk>

/** 일회용 초대 값으로 채널 공통의 링크와 안내 문구를 만든다. */
export function createInviteShareData(
  origin: string,
  roomName: string,
  invite: InviteValue,
): InviteShareData {
  const url = new URL(`/rooms/join?invite=${invite.token}`, origin).toString()
  return {
    text: `${roomName}에 초대해요.\n초대 코드: ${invite.code}\nTalk후감에서 코드를 입력해 함께 읽기 시작해요.`,
    title: `${roomName} 초대`,
    url,
  }
}

/** 브라우저에서 바로 열 수 있는 채널별 공유 주소를 반환한다. */
export function getInvitePlatformUrl(
  platform: InviteSharePlatform,
  shareData: InviteShareData,
): string | null {
  if (platform === 'sms') return `sms:?&body=${encodeURIComponent(getInviteCopyText(shareData))}`
  if (platform === 'facebook')
    return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareData.url)}`
  if (platform === 'instagram') return 'https://www.instagram.com/'
  return null
}

/** 초대 문구와 링크를 한 번에 복사할 텍스트로 합친다. */
export function getInviteCopyText(shareData: InviteShareData): string {
  return `${shareData.text}\n${shareData.url}`
}

/** Clipboard API 또는 구형 브라우저 fallback으로 초대 내용을 복사한다. */
export async function copyInviteText(
  text: string,
  clipboard: ClipboardApi | undefined = navigator.clipboard,
  documentApi: DocumentApi = document,
): Promise<void> {
  if (clipboard) {
    await clipboard.writeText(text)
    return
  }

  const textarea = documentApi.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  documentApi.body.appendChild(textarea)
  textarea.select()
  const wasCopied = documentApi.execCommand('copy')
  documentApi.body.removeChild(textarea)
  if (!wasCopied) throw new Error('INVITE_COPY_FAILED')
}

/** 카카오톡 JavaScript SDK로 초대 코드와 참여 링크를 친구 선택 화면에 전달한다. */
export async function shareInviteWithKakao(
  shareData: InviteShareData,
  javascriptKey: string,
  loadKakao: KakaoSdkLoader = loadKakaoSdk,
): Promise<void> {
  const kakao = await loadKakao()
  if (!kakao.isInitialized()) kakao.init(javascriptKey)
  kakao.Share.sendDefault({
    link: { mobileWebUrl: shareData.url, webUrl: shareData.url },
    objectType: 'text',
    text: shareData.text,
  })
}

/** SDK가 아직 없으면 공식 스크립트를 한 번만 추가하고 카카오 전역 객체를 반환한다. */
function loadKakaoSdk(): Promise<KakaoShareSdk> {
  const existingKakao = getKakaoSdk()
  if (existingKakao !== null) return Promise.resolve(existingKakao)

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.async = true
    script.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.8.0/kakao.min.js'
    script.onload = () => {
      const kakao = getKakaoSdk()
      if (kakao !== null) resolve(kakao)
      else reject(new Error('KAKAO_SDK_UNAVAILABLE'))
    }
    script.onerror = () => reject(new Error('KAKAO_SDK_LOAD_FAILED'))
    document.head.appendChild(script)
  })
}

/** 브라우저 전역 객체에 로드된 카카오 SDK를 확인해 반환한다. */
function getKakaoSdk(): KakaoShareSdk | null {
  const candidate = window as Window & { Kakao?: KakaoShareSdk }
  return candidate.Kakao ?? null
}
