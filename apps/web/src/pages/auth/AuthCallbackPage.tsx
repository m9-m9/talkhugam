import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { resolveAuthDestination } from '../../features/auth/resolveAuthDestination'
import { getOnboardingCompletedAt } from '../../entities/profile/getOnboardingStatus'
import { createSupabaseClient } from '../../shared/api/supabaseClient'

export function AuthCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
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
        const completedAt = await getOnboardingCompletedAt(client, response.data.user.id)
        void navigate(resolveAuthDestination(completedAt), { replace: true })
      } catch {
        setErrorMessage('프로필 정보를 불러오지 못했어요. 다시 시도해 주세요.')
      }
    }

    void resolveSession()
  }, [navigate, searchParams])

  return (
    <main className="bg-surface mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-6">
      <p className="text-ink-subtle text-sm" role={errorMessage ? 'alert' : 'status'}>
        {errorMessage ?? '로그인 정보를 확인하고 있어요.'}
      </p>
    </main>
  )
}
