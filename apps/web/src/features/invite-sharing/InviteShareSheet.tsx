import { BottomSheet } from '../../shared/ui/BottomSheet'

import { InviteShareActions } from './InviteShareActions'

export type InviteSharePlatform = 'kakao' | 'sms' | 'instagram' | 'facebook'

/** 초대 링크를 보낼 수 있는 플랫폼별 행동과 링크 복사 동작을 하단 시트로 제공한다. */
export function InviteShareSheet({
  inviteCode,
  onClose,
  onCopyInvite,
  onShare,
}: InviteShareSheetProps) {
  return (
    <BottomSheet onClose={onClose} title="책방 초대하기">
      <p className="text-ink-subtle mt-2 text-sm">친구에게 초대 링크와 코드를 보내 보세요.</p>
      {inviteCode ? (
        <div className="talkhugam-information-surface border-border mt-4 rounded-md border px-4 py-3">
          <p className="text-ink-subtle text-xs">초대 코드</p>
          <p className="text-ink mt-1 text-lg font-bold tracking-[0.16em]">{inviteCode}</p>
        </div>
      ) : null}
      <InviteShareActions onCopyInvite={onCopyInvite} onShare={onShare} />
    </BottomSheet>
  )
}

type InviteShareSheetProps = {
  inviteCode?: string
  onClose: () => void
  onCopyInvite: () => void
  onShare: (platform: InviteSharePlatform) => void
}
