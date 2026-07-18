import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { getProfile } from '../../entities/profile'
import { useAuthenticatedUser } from '../../features/auth'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { AppHeader } from '../../shared/ui/AppHeader'
import { LoadingSpinner } from '../../shared/ui/LoadingSpinner'
import { RetryState } from '../../shared/ui/RetryState'

type ProfileNavigationRowProps = {
  description: string
  label: string
  onClick: () => void
}

/** 현재 사용자의 기본 정보를 요약하고 네 개의 상세 화면 진입점을 렌더링한다. */
export function ProfilePage() {
  const navigate = useNavigate()
  const profileId = useAuthenticatedUser().id
  const [isRetryingProfile, setIsRetryingProfile] = useState(false)
  const profileQuery = useQuery({
    queryFn: () => getProfile(createSupabaseClient(), profileId),
    queryKey: ['profile', profileId],
  })

  /** 실패한 프로필 조회를 다시 요청하고 재시도 중 상태를 반환한다. */
  function handleRetryProfile() {
    setIsRetryingProfile(true)
    void profileQuery.refetch().finally(() => setIsRetryingProfile(false))
  }

  if (profileQuery.isPending && !isRetryingProfile) {
    return <ProfileState message="내 정보를 불러오고 있어요." />
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <ProfileRetryState
        isRetrying={isRetryingProfile}
        message="프로필 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요."
        onRetry={handleRetryProfile}
      />
    )
  }

  const profile = profileQuery.data

  return (
    <main className="app-page bg-surface px-4 pb-8">
      <AppHeader onBack={() => void navigate('/rooms')} title="내 정보" />

      <section aria-labelledby="profile-heading" className="mt-8">
        <div className="flex min-w-0 items-center gap-4">
          <div
            aria-hidden="true"
            className="bg-primary flex size-16 shrink-0 items-center justify-center rounded-full text-2xl font-semibold text-white"
          >
            {profile.displayName.slice(0, 1)}
          </div>
          <div className="min-w-0">
            <h1 className="text-ink text-xl font-bold" id="profile-heading">
              {profile.displayName}
            </h1>
            <p className="text-ink-subtle mt-1 truncate text-sm">
              {profile.bio || '아직 소개를 작성하지 않았어요.'}
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="profile-menu-heading" className="mt-12">
        <h2 className="text-ink text-base font-bold" id="profile-menu-heading">
          내 정보 메뉴
        </h2>
        <div className="border-ink/10 mt-4 border-y bg-white">
          <ProfileNavigationRow
            description="이름과 소개, MBTI를 바꿔요."
            label="내 정보 수정"
            onClick={() => void navigate('/profile/edit')}
          />
          <ProfileNavigationRow
            description="참여 중인 책방을 확인해요."
            label="책방 보기"
            onClick={() => void navigate('/rooms')}
          />
          <ProfileNavigationRow
            description="함께 읽는 책과 완독 기록을 봐요."
            label="읽고 있는 책 보기"
            onClick={() => void navigate('/profile/books')}
          />
          <ProfileNavigationRow
            description="로그인 수단과 계정을 관리해요."
            label="계정 설정"
            onClick={() => void navigate('/profile/settings')}
          />
        </div>
      </section>
    </main>
  )
}

/** 상세 화면으로 이동하는 메뉴 한 줄을 설명과 함께 렌더링한다. */
function ProfileNavigationRow({ description, label, onClick }: ProfileNavigationRowProps) {
  return (
    <button
      aria-label={label}
      className="border-ink/10 hover:bg-surface-muted focus-visible:ring-primary flex min-h-16 w-full items-center justify-between gap-4 border-b px-4 py-3 text-left last:border-b-0 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      onClick={onClick}
      type="button"
    >
      <span className="min-w-0">
        <span className="text-ink block text-sm font-semibold">{label}</span>
        <span className="text-ink-subtle mt-1 block text-xs">{description}</span>
      </span>
      <span aria-hidden="true" className="text-ink-subtle text-lg">
        ›
      </span>
    </button>
  )
}

/** 프로필을 불러오는 동안 안내 문구와 로딩 상태를 렌더링한다. */
function ProfileState({ message }: { message: string }) {
  return (
    <main className="app-page bg-surface flex items-center justify-center px-4">
      <LoadingSpinner label={message} />
    </main>
  )
}

/** 프로필 조회 실패를 재시도 버튼과 진행 상태로 안내한다. */
function ProfileRetryState({
  isRetrying,
  message,
  onRetry,
}: {
  isRetrying: boolean
  message: string
  onRetry: () => void
}) {
  return (
    <main className="app-page bg-surface flex flex-col items-center justify-center gap-4 px-4">
      <RetryState isRetrying={isRetrying} message={message} onRetry={onRetry} />
      {isRetrying ? <LoadingSpinner label="내 정보를 다시 불러오고 있어요." /> : null}
    </main>
  )
}
