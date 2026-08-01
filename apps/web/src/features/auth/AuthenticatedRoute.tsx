import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { z } from 'zod'

import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { BookLoadingIndicator } from '../../shared/ui/LoadingSpinner'
import { authenticatedUserContext, type AuthenticatedUser } from './authenticatedUser'

const authenticatedUserSchema = z.object({
  app_metadata: z.unknown().default({}),
  email: z.string().email().nullable().optional(),
  id: z.string().min(1),
  user_metadata: z.unknown().default({}),
})

/** 인증 라우트 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
export function AuthenticatedRoute() {
  const [user, setUser] = useState<AuthenticatedUser | null | undefined>(undefined)

  useEffect(() => {
    let isActive = true

    /** 현재 Supabase 세션을 확인해 보호된 화면의 접근 상태를 결정한다. */
    async function authenticate() {
      const response = await createSupabaseClient().auth.getUser()
      if (!isActive) return
      if (response.error || !response.data.user) {
        setUser(null)
        return
      }

      const parsedUser = authenticatedUserSchema.parse(response.data.user)
      setUser({
        appMetadata: parsedUser.app_metadata,
        email: parsedUser.email ?? null,
        id: parsedUser.id,
        userMetadata: parsedUser.user_metadata,
      })
    }

    void authenticate()
    return () => {
      isActive = false
    }
  }, [])

  if (user === undefined)
    return (
      <main className="bg-surface flex min-h-screen items-center justify-center px-4">
        <BookLoadingIndicator label="로그인 정보를 확인하고 있어요." size="sm" />
      </main>
    )
  if (user === null) return <Navigate replace to="/" />

  return (
    <authenticatedUserContext.Provider value={user}>
      <Outlet />
    </authenticatedUserContext.Provider>
  )
}
