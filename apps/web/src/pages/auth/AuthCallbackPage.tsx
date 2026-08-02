import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { bookBestsellerKeys, getBookBestsellers } from '../../entities/bestseller'
import { getHasRequiredLegalConsent } from '../../entities/legal'
import { getOnboardingCompletedAt } from '../../entities/profile'
import { getReadingRooms, readingRoomKeys } from '../../entities/reading-room'
import { resolveAuthDestination } from '../../features/auth'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { trackAnalyticsEvent } from '../../shared/analytics'
import { BookLoadingIndicator } from '../../shared/ui/LoadingSpinner'

/** 인증 callback 페이지 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
export function AuthCallbackPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    /** 현재 조건에 맞는 로그인 세션을 결정해 반환한다. */
    async function resolveSession() {
      if (searchParams.has('auth_error')) {
        if (isActive) {
          setErrorMessage('로그인이 취소되었거나 만료되었어요. 다시 시도해 주세요.')
        }
        return
      }

      const client = createSupabaseClient()
      const response = await client.auth.getUser()
      if (!isActive) return

      if (response.error || !response.data.user) {
        setErrorMessage('로그인 정보를 확인하지 못했어요. 다시 시도해 주세요.')
        return
      }

      try {
        const destination = await getAuthDestination(client, response.data.user.id)
        if (!isActive) return

        if (destination === '/rooms') {
          await prepareRoomLanding(queryClient, client)
          if (!isActive) return
        }

        trackAnalyticsEvent('login_completed')
        void navigate(destination, { replace: true })
      } catch {
        if (isActive) {
          setErrorMessage('프로필 정보를 불러오지 못했어요. 다시 시도해 주세요.')
        }
      }
    }

    void resolveSession()

    return () => {
      isActive = false
    }
  }, [navigate, queryClient, searchParams])

  return (
    <main className="app-page bg-surface flex items-center justify-center px-4">
      {errorMessage ? (
        <p className="text-ink-subtle text-sm" role="alert">
          {errorMessage}
        </p>
      ) : (
        <BookLoadingIndicator label="책방 정보를 불러오고 있어요." size="sm" />
      )}
    </main>
  )
}

/** 로그인 직후 생성 중인 프로필과 동의 정보를 한 번 더 확인해 다음 화면 경로를 반환한다. */
async function getAuthDestination(
  client: ReturnType<typeof createSupabaseClient>,
  profileId: string,
) {
  try {
    return await getAuthDestinationFromProfile(client, profileId)
  } catch {
    return getAuthDestinationFromProfile(client, profileId)
  }
}

/** 프로필 완료 여부와 필수 약관 동의 여부로 인증 후 이동할 경로를 계산한다. */
async function getAuthDestinationFromProfile(
  client: ReturnType<typeof createSupabaseClient>,
  profileId: string,
) {
  const [completedAt, hasRequiredConsent] = await Promise.all([
    getOnboardingCompletedAt(client, profileId),
    getHasRequiredLegalConsent(client, profileId),
  ])

  return resolveAuthDestination(completedAt, hasRequiredConsent)
}

/** 메인 화면에 필요한 책방과 베스트셀러 데이터를 캐시에 함께 준비한다. */
async function prepareRoomLanding(
  queryClient: ReturnType<typeof useQueryClient>,
  client: ReturnType<typeof createSupabaseClient>,
) {
  await Promise.all([
    queryClient.prefetchQuery({
      queryFn: () => getReadingRooms(client),
      queryKey: readingRoomKeys.all,
    }),
    queryClient.prefetchQuery({
      queryFn: () => getBookBestsellers(client),
      queryKey: bookBestsellerKeys.current,
      staleTime: 10 * 60 * 1000,
    }),
  ])
}
