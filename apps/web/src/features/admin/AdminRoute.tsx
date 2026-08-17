import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'

import { getAdminAccess } from '../../entities/feedback'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { BrandLoadingSpinner } from '../../shared/ui/LoadingSpinner'

/** 운영함 허용 목록을 확인한 뒤 운영자만 하위 관리 화면으로 진입시킨다. */
export function AdminRoute() {
  const [hasAdminAccess, setHasAdminAccess] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    let isActive = true

    /** Edge Function의 운영자 접근 결과를 현재 라우트 상태에 반영한다. */
    async function loadAccess() {
      const hasAccess = await getAdminAccess(createSupabaseClient())
      if (isActive) setHasAdminAccess(hasAccess)
    }

    void loadAccess()
    return () => {
      isActive = false
    }
  }, [])

  if (hasAdminAccess === undefined) {
    return (
      <main className="bg-surface flex min-h-screen items-center justify-center px-4">
        <BrandLoadingSpinner label="운영함 권한을 확인하고 있어요." />
      </main>
    )
  }
  if (!hasAdminAccess) return <Navigate replace to="/rooms" />
  return <Outlet />
}
