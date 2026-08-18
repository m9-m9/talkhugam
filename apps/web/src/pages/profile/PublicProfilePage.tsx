import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { publicProfileKeys } from '@talkhugam/domain'
import { ActionButton } from '@seed-design/react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'

import {
  followPublicProfile,
  getPublicProfile,
  listPublicProfileFollowers,
  unfollowPublicProfile,
} from '../../entities/profile'
import { reportCommunityTarget } from '../../entities/community'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { AppHeader } from '../../shared/ui/AppHeader'
import { BrandLoadingSpinner } from '../../shared/ui/LoadingSpinner'
import { RetryState } from '../../shared/ui/RetryState'

/** 다른 회원의 공개 허용 프로필과 팔로워 목록, 단방향 팔로우 행동을 표시한다. */
export function PublicProfilePage() {
  const navigate = useNavigate()
  const profileId = z.string().uuid().safeParse(useParams().profileId).data
  const queryClient = useQueryClient()
  const [reportReason, setReportReason] = useState('')
  const profileQuery = useQuery({
    enabled: Boolean(profileId),
    queryFn: () => getPublicProfile(createSupabaseClient(), profileId ?? ''),
    queryKey: publicProfileKeys.detail(profileId ?? ''),
  })
  const followersQuery = useQuery({
    enabled: Boolean(profileId),
    queryFn: () => listPublicProfileFollowers(createSupabaseClient(), profileId ?? ''),
    queryKey: publicProfileKeys.followers(profileId ?? ''),
  })
  const followMutation = useMutation({
    mutationFn: (isFollowing: boolean) =>
      isFollowing
        ? unfollowPublicProfile(createSupabaseClient(), profileId ?? '')
        : followPublicProfile(createSupabaseClient(), profileId ?? ''),
    onSuccess: (_result, wasFollowing) => {
      if (!profileId) return
      queryClient.setQueryData(
        publicProfileKeys.detail(profileId),
        (current: typeof profileQuery.data) =>
          current
            ? {
                ...current,
                followerCount: Math.max(0, current.followerCount + (wasFollowing ? -1 : 1)),
                isFollowing: !wasFollowing,
              }
            : current,
      )
      void queryClient.invalidateQueries({ queryKey: publicProfileKeys.followers(profileId) })
    },
  })
  const reportMutation = useMutation({
    mutationFn: () =>
      reportCommunityTarget(createSupabaseClient(), 'profile', profileId ?? '', reportReason),
    onSuccess: () => setReportReason(''),
  })

  /** 이전 화면이 있으면 돌아가고 없으면 책방 목록으로 이동한다. */
  function handleBack(): void {
    navigate(-1)
  }

  /** 현재 팔로우 상태와 반대되는 RPC를 실행한다. */
  function handleToggleFollow(): void {
    if (!profileQuery.data || followMutation.isPending) return
    followMutation.mutate(profileQuery.data.isFollowing)
  }

  /** 입력된 사유가 있는 경우에만 현재 공개 프로필을 신고한다. */
  function handleReportProfile(): void {
    if (!profileId || !reportReason.trim() || reportMutation.isPending) return
    reportMutation.mutate()
  }

  if (profileQuery.isPending) return <PublicProfileLoading />
  if (!profileId || profileQuery.isError || !profileQuery.data)
    return <PublicProfileFailure onBack={handleBack} onRetry={() => void profileQuery.refetch()} />

  const profile = profileQuery.data
  const actionLabel = `${profile.displayName} ${profile.isFollowing ? '언팔로우' : '팔로우'}`
  return (
    <main className="app-page bg-surface px-4 pb-8">
      <AppHeader onBack={handleBack} title="프로필" />
      <section className="mt-8 text-center" aria-labelledby="public-profile-name">
        <div
          aria-hidden
          className="bg-brand text-ink mx-auto flex size-20 items-center justify-center rounded-full text-3xl font-bold"
        >
          {profile.displayName.slice(0, 1)}
        </div>
        <h1 className="text-ink mt-4 text-2xl font-bold" id="public-profile-name">
          {profile.displayName}
        </h1>
        <p className="text-ink-subtle mt-2 text-sm break-keep">
          {profile.bio || '아직 소개를 작성하지 않았어요.'}
        </p>
        <p className="text-ink mt-4 text-sm font-bold">팔로워 {profile.followerCount}명</p>
        <ActionButton
          aria-label={actionLabel}
          className="talkhugam-primary-action mt-6 w-full"
          disabled={followMutation.isPending}
          onClick={handleToggleFollow}
          size="large"
          type="button"
          variant={profile.isFollowing ? 'neutralOutline' : 'brandSolid'}
        >
          {followMutation.isPending ? '저장 중…' : profile.isFollowing ? '언팔로우' : '팔로우'}
        </ActionButton>
        {followMutation.isError ? (
          <p className="mt-3 text-sm text-red-600" role="alert">
            팔로우 상태를 저장하지 못했어요. 다시 시도해 주세요.
          </p>
        ) : null}
      </section>
      <section className="mt-12" aria-labelledby="public-profile-followers">
        <h2 className="text-ink text-base font-bold" id="public-profile-followers">
          팔로워
        </h2>
        {followersQuery.isPending ? (
          <BrandLoadingSpinner label="팔로워를 불러오고 있어요." />
        ) : null}
        {followersQuery.isError ? (
          <RetryState
            message="팔로워를 불러오지 못했어요."
            onRetry={() => void followersQuery.refetch()}
          />
        ) : null}
        {followersQuery.data?.length === 0 ? (
          <p className="text-ink-subtle mt-4 text-sm">아직 팔로워가 없어요.</p>
        ) : null}
        <ul className="mt-4 divide-y divide-black/10 rounded-lg border border-black/10 bg-white">
          {followersQuery.data?.map((follower) => (
            <li key={follower.id}>
              <Link
                className="text-ink flex min-h-11 items-center px-4 py-3 text-sm font-medium"
                to={`/profiles/${follower.id}`}
              >
                {follower.displayName}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section
        className="border-border mt-12 border-t pt-8"
        aria-labelledby="public-profile-report"
      >
        <h2 className="text-ink text-base font-bold" id="public-profile-report">
          프로필 신고
        </h2>
        <p className="text-ink-subtle mt-2 text-sm">운영 확인이 필요한 사유를 알려 주세요.</p>
        <label className="sr-only" htmlFor="public-profile-report-reason">
          신고 사유
        </label>
        <textarea
          className="border-border text-ink mt-4 min-h-24 w-full rounded-lg border p-3 text-sm"
          disabled={reportMutation.isPending}
          id="public-profile-report-reason"
          maxLength={500}
          onChange={(event) => setReportReason(event.target.value)}
          placeholder="신고 사유를 입력해 주세요."
          value={reportReason}
        />
        <ActionButton
          className="talkhugam-foundation-action--outline mt-3 w-full"
          disabled={reportMutation.isPending || !reportReason.trim()}
          onClick={handleReportProfile}
          size="large"
          type="button"
          variant="neutralOutline"
        >
          {reportMutation.isPending ? '신고 중…' : '신고하기'}
        </ActionButton>
        {reportMutation.isSuccess ? (
          <p className="text-primary mt-3 text-sm" role="status">
            신고가 접수되었어요.
          </p>
        ) : null}
        {reportMutation.isError ? (
          <p className="text-danger mt-3 text-sm" role="alert">
            신고를 접수하지 못했어요. 다시 시도해 주세요.
          </p>
        ) : null}
      </section>
    </main>
  )
}

/** 공개 프로필을 불러오는 동안 공통 브랜드 진행 상태를 렌더링한다. */
function PublicProfileLoading() {
  return (
    <main className="app-page bg-surface flex min-h-screen items-center justify-center px-4">
      <BrandLoadingSpinner label="프로필을 불러오고 있어요." />
    </main>
  )
}

/** 잘못된 프로필 또는 실패한 공개 프로필 조회를 재시도·뒤로가기와 함께 렌더링한다. */
function PublicProfileFailure({ onBack, onRetry }: { onBack(): void; onRetry(): void }) {
  return (
    <main className="app-page bg-surface flex min-h-screen flex-col items-center justify-center gap-4 px-4">
      <RetryState message="프로필을 불러오지 못했어요." onRetry={onRetry} />
      <ActionButton
        className="talkhugam-foundation-action--outline"
        onClick={onBack}
        size="large"
        type="button"
        variant="neutralOutline"
      >
        이전으로
      </ActionButton>
    </main>
  )
}
