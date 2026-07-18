import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { getProfile } from '../../entities/profile'
import { getRoomManagement, roomManagementKeys } from '../../entities/room-management'
import { useAuthenticatedUser } from '../../features/auth'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { AppHeader } from '../../shared/ui/AppHeader'
import { LoadingSpinner } from '../../shared/ui/LoadingSpinner'
import { RetryState } from '../../shared/ui/RetryState'

/** 같은 책방에서 함께 읽는 멤버의 공개 프로필을 렌더링한다. */
export function MemberProfilePage() {
  const navigate = useNavigate()
  const { profileId, roomId } = useParams()
  const currentUser = useAuthenticatedUser()
  const client = createSupabaseClient()
  const roomQuery = useQuery({
    enabled: Boolean(roomId),
    queryFn: () => getRoomManagement(client, roomId ?? '', currentUser.id),
    queryKey: roomManagementKeys.detail(roomId ?? ''),
  })
  const member = roomQuery.data?.members.find((roomMember) => roomMember.profileId === profileId)
  const profileQuery = useQuery({
    enabled: Boolean(member?.profileId),
    queryFn: () => getProfile(client, member?.profileId ?? ''),
    queryKey: ['profile', member?.profileId],
  })

  if (roomQuery.isPending)
    return <MemberProfileLoadingPage message="멤버 정보를 불러오고 있어요." />
  if (roomQuery.isError || !member || !roomId)
    return <MemberProfileUnavailablePage onBack={() => void navigate('/rooms')} />
  if (profileQuery.isPending)
    return <MemberProfileLoadingPage message="프로필을 불러오고 있어요." />
  if (profileQuery.isError || !profileQuery.data)
    return (
      <MemberProfileErrorPage
        onBack={() => void navigate(`/rooms/${roomId}`)}
        onRetry={() => void profileQuery.refetch()}
      />
    )

  const profile = profileQuery.data

  return (
    <main className="app-page bg-surface px-4 pb-8">
      <AppHeader onBack={() => void navigate(`/rooms/${roomId}`)} title="멤버 프로필" />
      <section className="mt-8" aria-labelledby="member-profile-heading">
        <div className="flex items-center gap-4">
          <div
            aria-hidden="true"
            className="bg-primary flex size-16 shrink-0 items-center justify-center rounded-full text-2xl font-semibold text-white"
          >
            {profile.displayName.slice(0, 1)}
          </div>
          <div>
            <h1 className="text-ink text-xl font-bold" id="member-profile-heading">
              {profile.displayName}
            </h1>
            <p className="text-ink-subtle mt-1 text-sm">같은 책방에서 함께 읽고 있어요.</p>
          </div>
        </div>
      </section>

      <section className="mt-12" aria-labelledby="member-introduction-heading">
        <h2 className="text-ink text-base font-bold" id="member-introduction-heading">
          소개
        </h2>
        <dl className="border-ink/10 mt-4 overflow-hidden rounded-lg border bg-white">
          <MemberProfileDetail
            label="한 줄 소개"
            value={profile.bio || '아직 소개를 작성하지 않았어요.'}
          />
          <MemberProfileDetail label="MBTI" value={profile.mbti || '선택 안 함'} />
        </dl>
      </section>

      <Link
        className="bg-primary mt-12 flex min-h-11 w-full items-center justify-center rounded-md px-4 text-sm font-semibold text-white"
        to={`/rooms/${roomId}`}
      >
        책방으로 돌아가기
      </Link>
    </main>
  )
}

/** 멤버 프로필의 하나의 공개 필드를 읽기 전용 행으로 렌더링한다. */
function MemberProfileDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-ink/10 flex items-start justify-between gap-6 border-b px-4 py-4 last:border-b-0">
      <dt className="text-ink-subtle text-sm">{label}</dt>
      <dd className="text-ink max-w-48 text-right text-sm">{value}</dd>
    </div>
  )
}

/** 멤버 프로필 조회 중 브랜드 스피너를 제공한다. */
function MemberProfileLoadingPage({ message }: { message: string }) {
  return (
    <main className="app-page bg-surface flex min-h-screen items-center justify-center px-4">
      <LoadingSpinner label={message} />
    </main>
  )
}

/** 같은 방에서 확인할 수 없는 멤버를 안전하게 안내한다. */
function MemberProfileUnavailablePage({ onBack }: { onBack: () => void }) {
  return (
    <main className="app-page bg-surface flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-ink text-lg font-bold">이 멤버 정보를 찾을 수 없어요.</p>
      <button
        className="bg-primary min-h-11 rounded-md px-4 text-sm font-semibold text-white"
        onClick={onBack}
        type="button"
      >
        내 책방으로
      </button>
    </main>
  )
}

/** 멤버 프로필 조회 실패를 재시도 행동과 함께 안내한다. */
function MemberProfileErrorPage({ onBack, onRetry }: { onBack: () => void; onRetry: () => void }) {
  return (
    <main className="app-page bg-surface flex min-h-screen flex-col items-center justify-center gap-4 px-4">
      <RetryState
        message="멤버 프로필을 불러오지 못했어요. 잠시 후 다시 시도해 주세요."
        onRetry={onRetry}
      />
      <button
        className="border-ink/10 min-h-11 rounded-md border bg-white px-4 text-sm font-semibold"
        onClick={onBack}
        type="button"
      >
        책방으로 돌아가기
      </button>
    </main>
  )
}
