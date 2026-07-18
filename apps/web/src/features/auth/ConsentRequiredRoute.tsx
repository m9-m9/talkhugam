import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'

import { getHasRequiredLegalConsent } from '../../entities/legal'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { LoadingSpinner } from '../../shared/ui/LoadingSpinner'
import { useAuthenticatedUser } from './authenticatedUser'

/** 필수 정책 동의를 마친 사용자만 서비스 내부 화면에 진입시킨다. */
export function ConsentRequiredRoute() {
  const user = useAuthenticatedUser()
  const [hasRequiredConsent, setHasRequiredConsent] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    let isActive = true

    /** 현재 사용자의 필수 정책 동의 상태를 조회한다. */
    async function loadRequiredConsent() {
      try {
        const hasConsent = await getHasRequiredLegalConsent(createSupabaseClient(), user.id)
        if (isActive) setHasRequiredConsent(hasConsent)
      } catch {
        if (isActive) setHasRequiredConsent(false)
      }
    }

    void loadRequiredConsent()
    return () => {
      isActive = false
    }
  }, [user.id])

  if (hasRequiredConsent === undefined)
    return (
      <main className="bg-surface flex min-h-screen items-center justify-center px-4">
        <h1 className="sr-only">서비스 이용 동의를 확인하고 있어요.</h1>
        <LoadingSpinner label="서비스 이용 동의를 확인하고 있어요." />
      </main>
    )
  if (!hasRequiredConsent) return <Navigate replace to="/legal-consent" />

  return <Outlet />
}
