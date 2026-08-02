import { KakaoLogo } from '../../shared/ui/KakaoLogo'

import type { InviteSharePlatform } from './InviteShareSheet'

type InviteShareActionsProps = {
  onCopyInvite: () => void
  onShare: (platform: InviteSharePlatform) => void
}

/** 초대 카드와 바텀시트에서 공통으로 쓰는 공유 대상과 링크 복사 행동을 렌더링한다. */
export function InviteShareActions({ onCopyInvite, onShare }: InviteShareActionsProps) {
  return (
    <>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <InvitePlatformButton label="카카오톡" onClick={() => onShare('kakao')} platform="kakao" />
        <InvitePlatformButton label="문자" onClick={() => onShare('sms')} platform="sms" />
        <InvitePlatformButton
          label="인스타그램"
          onClick={() => onShare('instagram')}
          platform="instagram"
        />
        <InvitePlatformButton
          label="페이스북"
          onClick={() => onShare('facebook')}
          platform="facebook"
        />
      </div>
      <button
        aria-label="초대 링크와 코드 복사"
        className="border-ink/10 text-ink mt-3 flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-md border bg-white px-4 text-sm font-semibold"
        onClick={onCopyInvite}
        type="button"
      >
        <LinkIcon />
        링크와 코드 복사
      </button>
      <p className="text-ink-subtle mt-3 text-xs">
        인스타그램은 링크를 복사한 뒤 앱에서 붙여 넣어 보낼 수 있어요.
      </p>
    </>
  )
}

/** 플랫폼별 공유 행동을 아이콘과 이름이 함께 보이는 터치 버튼으로 렌더링한다. */
function InvitePlatformButton({ label, onClick, platform }: InvitePlatformButtonProps) {
  return (
    <button
      aria-label={getInviteShareActionLabel(label)}
      className="border-ink/10 text-ink flex min-h-16 cursor-pointer items-center justify-center gap-2 rounded-md border bg-white px-3 text-sm font-semibold"
      onClick={onClick}
      type="button"
    >
      <PlatformIcon platform={platform} />
      {label}
    </button>
  )
}

/** 공유 대상 이름에 맞는 자연스러운 접근성 행동 문구를 만든다. */
function getInviteShareActionLabel(label: string): string {
  return label === '문자' ? '문자로 초대 보내기' : `${label}으로 초대 보내기`
}

/** 공유 대상마다 구분되는 간결한 브랜드형 아이콘을 렌더링한다. */
function PlatformIcon({ platform }: { platform: InviteSharePlatform }) {
  if (platform === 'kakao')
    return (
      <span
        aria-hidden="true"
        className="flex size-6 items-center justify-center rounded-full bg-[#FEE500] text-[#191600]"
      >
        <KakaoLogo size={16} />
      </span>
    )
  if (platform === 'sms')
    return (
      <span
        aria-hidden="true"
        className="bg-primary flex size-6 items-center justify-center rounded-md text-xs font-bold text-white"
      >
        ✦
      </span>
    )
  if (platform === 'instagram')
    return (
      <span
        aria-hidden="true"
        className="flex size-6 items-center justify-center rounded-md bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#FCAF45] text-xs font-bold text-white"
      >
        ◎
      </span>
    )
  return (
    <span
      aria-hidden="true"
      className="flex size-6 items-center justify-center rounded-full bg-[#1877F2] text-sm font-bold text-white"
    >
      f
    </span>
  )
}

/** 링크 복사 동작의 의미를 보조하는 연결 아이콘을 렌더링한다. */
function LinkIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M10 13a5 5 0 0 0 7.07.07l2-2A5 5 0 0 0 12 4l-1.15 1.15"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
      <path
        d="M14 11a5 5 0 0 0-7.07-.07l-2 2A5 5 0 0 0 12 20l1.15-1.15"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  )
}

type InvitePlatformButtonProps = {
  label: string
  onClick: () => void
  platform: InviteSharePlatform
}
