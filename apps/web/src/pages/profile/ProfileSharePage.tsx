import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ActionButton } from '@seed-design/react'

import { getProfile } from '../../entities/profile'
import { useAuthenticatedUser } from '../../features/auth'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { AppHeader } from '../../shared/ui/AppHeader'
import { BrandLoadingSpinner } from '../../shared/ui/LoadingSpinner'
import { RetryState } from '../../shared/ui/RetryState'

/** 현재 사용자의 독서 성향을 공유 가능한 카드로 미리 보여 준다. */
export function ProfileSharePage() {
  const navigate = useNavigate()
  const user = useAuthenticatedUser()
  const [feedback, setFeedback] = useState<string | null>(null)
  const profileQuery = useQuery({
    queryFn: () => getProfile(createSupabaseClient(), user.id),
    queryKey: ['profile', user.id],
  })

  /** 플랫폼 공유 시트를 열거나 지원하지 않는 환경에서는 링크를 복사한다. */
  async function handleShare() {
    if (!profileQuery.data) return

    const shareData = createProfileShareData(profileQuery.data.displayName, profileQuery.data.bio)
    if (navigator.share) {
      await navigator.share(shareData)
      return
    }

    await navigator.clipboard.writeText(shareData.text)
    setFeedback('공유 문구를 클립보드에 복사했어요.')
  }

  if (profileQuery.isPending)
    return <ProfileShareLoadingPage message="공유 카드를 준비하고 있어요." />
  if (profileQuery.isError || !profileQuery.data)
    return (
      <ProfileShareErrorPage
        onBack={() => void navigate('/profile')}
        onRetry={() => void profileQuery.refetch()}
      />
    )

  const profile = profileQuery.data

  return (
    <main className="app-page bg-surface px-4 pb-8">
      <AppHeader onBack={() => void navigate('/profile')} title="공유 카드" />
      <header className="mt-8">
        <p className="text-primary text-sm font-medium">나의 독서 기록</p>
        <h1 className="text-ink mt-2 text-2xl font-bold">공유 카드</h1>
        <p className="text-ink-subtle mt-2 text-sm">
          내가 좋아하는 독서 방식을 가볍게 나눠 보세요.
        </p>
      </header>

      <section
        aria-labelledby="profile-share-card-heading"
        className="border-primary bg-surface-muted mt-12 overflow-hidden rounded-lg border p-6"
      >
        <p className="text-primary text-sm font-semibold">Talk후감</p>
        <h2 className="text-ink mt-8 text-2xl font-bold" id="profile-share-card-heading">
          {profile.displayName}의 독서 카드
        </h2>
        <p className="text-ink mt-4 text-lg font-medium">
          {profile.bio || '읽고 느낀 마음을 함께 나눠요.'}
        </p>
        <div className="border-primary/30 mt-12 border-t pt-4">
          <p className="text-ink-subtle text-sm">{profile.mbti || '나만의 독서 취향'}</p>
          <p className="text-ink mt-1 text-sm font-semibold">함께 읽고, 함께 나누는 Talk후감</p>
        </div>
      </section>

      <ActionButton
        className="talkhugam-primary-action !mt-8 w-full"
        onClick={() => void handleShare()}
        size="large"
        type="button"
        variant="brandSolid"
      >
        공유하기
      </ActionButton>
      {feedback ? (
        <p className="text-primary mt-3 text-center text-sm" role="status">
          {feedback}
        </p>
      ) : null}
    </main>
  )
}

/** 공유 API로 전달할 안전한 텍스트를 생성한다. */
function createProfileShareData(displayName: string, bio: string | null) {
  const description = bio || '읽고 느낀 마음을 함께 나눠요.'
  return {
    text: `${displayName}의 Talk후감 프로필\n${description}`,
    title: `${displayName}의 Talk후감 프로필`,
  }
}

/** 공유 카드 조회 중 브랜드 스피너를 렌더링한다. */
function ProfileShareLoadingPage({ message }: { message: string }) {
  return (
    <main className="app-page bg-surface flex min-h-screen items-center justify-center px-4">
      <BrandLoadingSpinner label={message} />
    </main>
  )
}

/** 공유 카드 조회 실패를 재시도와 함께 안내한다. */
function ProfileShareErrorPage({ onBack, onRetry }: { onBack: () => void; onRetry: () => void }) {
  return (
    <main className="app-page bg-surface flex min-h-screen flex-col items-center justify-center gap-4 px-4">
      <RetryState
        message="공유 카드를 불러오지 못했어요. 잠시 후 다시 시도해 주세요."
        onRetry={onRetry}
      />
      <ActionButton
        className="talkhugam-foundation-action--outline"
        onClick={onBack}
        size="large"
        type="button"
        variant="neutralOutline"
      >
        내 정보로 돌아가기
      </ActionButton>
    </main>
  )
}
