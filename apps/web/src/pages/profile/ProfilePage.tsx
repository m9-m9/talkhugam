import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { getProfile } from '../../entities/profile'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { LoadingSpinner } from '../../shared/ui/LoadingSpinner'

export function ProfilePage() {
  const navigate = useNavigate()
  const [profileId, setProfileId] = useState<string | null>(null)
  const profileQuery = useQuery({
    enabled: Boolean(profileId),
    queryFn: () => getProfile(createSupabaseClient(), profileId ?? ''),
    queryKey: ['profile', profileId],
  })

  useEffect(() => {
    async function loadSession() {
      const response = await createSupabaseClient().auth.getUser()
      if (response.error || !response.data.user) {
        void navigate('/', { replace: true })
        return
      }

      setProfileId(response.data.user.id)
    }

    void loadSession()
  }, [navigate])

  if (!profileId || profileQuery.isPending)
    return <ProfileState message="내 정보를 불러오고 있어요." />
  if (profileQuery.isError || !profileQuery.data)
    return <ProfileState message="프로필 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요." />

  const profile = profileQuery.data

  return (
    <main className="bg-surface mx-auto min-h-screen w-full max-w-md px-6 py-8">
      <header className="flex items-center justify-between">
        <button
          className="text-ink-subtle -ml-3 min-h-11 px-3 text-sm"
          onClick={() => void navigate('/rooms')}
          type="button"
        >
          ← 내 독서방
        </button>
        <button
          className="text-primary min-h-11 px-3 text-sm font-medium"
          onClick={() => void navigate('/profile/settings')}
          type="button"
        >
          설정
        </button>
      </header>

      <section className="mt-8" aria-labelledby="profile-heading">
        <div className="flex items-start justify-between gap-4">
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
              <p className="text-ink-subtle mt-1 text-sm">
                {profile.bio || '아직 소개를 작성하지 않았어요.'}
              </p>
            </div>
          </div>
          <button
            className="border-ink/10 min-h-11 shrink-0 rounded-md border bg-white px-3 text-sm font-medium"
            onClick={() => void navigate('/profile/edit')}
            type="button"
          >
            프로필 편집
          </button>
        </div>
      </section>

      <section className="mt-12" aria-labelledby="profile-details-heading">
        <h2 className="text-ink text-base font-bold" id="profile-details-heading">
          프로필 정보
        </h2>
        <dl className="border-ink/10 mt-4 overflow-hidden rounded-lg border bg-white">
          <ProfileDetail label="한 줄 소개" value={profile.bio || '입력한 소개가 없어요'} />
          <ProfileDetail label="MBTI" value={profile.mbti || '선택 안 함'} />
        </dl>
      </section>

      <section className="mt-12" aria-labelledby="account-heading">
        <h2 className="text-ink text-base font-bold" id="account-heading">
          계정
        </h2>
        <button
          className="border-ink/10 mt-4 flex min-h-16 w-full items-center justify-between rounded-lg border bg-white px-4 text-left"
          onClick={() => void navigate('/profile/settings')}
          type="button"
        >
          <span>
            <span className="text-ink block text-sm font-medium">계정 설정</span>
            <span className="text-ink-subtle mt-1 block text-xs">
              로그인 수단과 계정을 관리해요.
            </span>
          </span>
          <span aria-hidden="true" className="text-ink-subtle text-lg">
            ›
          </span>
        </button>
      </section>
    </main>
  )
}

function ProfileDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-ink/10 flex items-start justify-between gap-6 border-b px-4 py-4 last:border-b-0">
      <dt className="text-ink-subtle text-sm">{label}</dt>
      <dd className="text-ink max-w-56 text-right text-sm">{value}</dd>
    </div>
  )
}

function ProfileState({ message }: { message: string }) {
  return (
    <main className="bg-surface mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-6">
      <LoadingSpinner label={message} />
    </main>
  )
}
