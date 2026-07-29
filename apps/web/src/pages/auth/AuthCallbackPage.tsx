import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { getHasRequiredLegalConsent } from '../../entities/legal'
import { getOnboardingCompletedAt } from '../../entities/profile'
import { resolveAuthDestination } from '../../features/auth'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { trackAnalyticsEvent } from '../../shared/analytics'
import { BookLoadingIndicator } from '../../shared/ui/LoadingSpinner'

/** 인증 callback 페이지 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
export function AuthCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    /** 현재 조건에 맞는 로그인 세션을 결정해 반환한다. */
    async function resolveSession() {
      if (searchParams.has('auth_error')) {
        setErrorMessage('로그인이 취소되었거나 만료되었어요. 다시 시도해 주세요.')
        return
      }

      const client = createSupabaseClient()
      const response = await client.auth.getUser()
      if (response.error || !response.data.user) {
        setErrorMessage('로그인 정보를 확인하지 못했어요. 다시 시도해 주세요.')
        return
      }

      try {
        const [completedAt, hasRequiredConsent] = await Promise.all([
          getOnboardingCompletedAt(client, response.data.user.id),
          getHasRequiredLegalConsent(client, response.data.user.id),
        ])
        trackAnalyticsEvent('login_completed')
        void navigate(resolveAuthDestination(completedAt, hasRequiredConsent), { replace: true })
      } catch {
        setErrorMessage('프로필 정보를 불러오지 못했어요. 다시 시도해 주세요.')
      }
    }

    void resolveSession()
  }, [navigate, searchParams])

  return (
    <main className="app-page bg-surface flex items-center justify-center px-4">
      {errorMessage ? (
        <p className="text-ink-subtle text-sm" role="alert">
          {errorMessage}
        </p>
      ) : (
        <BookLoadingIndicator label="로그인 정보를 확인하고 있어요." size="sm" />
      )}
    </main>
  )
}
