import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { z } from 'zod'

import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { LoadingSpinner } from '../../shared/ui/LoadingSpinner'
import { authenticatedUserContext, type AuthenticatedUser } from './authenticatedUser'

const authenticatedUserSchema = z.object({
  app_metadata: z.unknown().default({}),
  email: z.string().email().nullable().optional(),
  id: z.string().min(1),
})

export function AuthenticatedRoute() {
  const [user, setUser] = useState<AuthenticatedUser | null | undefined>(undefined)

  useEffect(() => {
    let isActive = true

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
        <LoadingSpinner label="로그인 정보를 확인하고 있어요." />
      </main>
    )
  if (user === null) return <Navigate replace to="/" />

  return (
    <authenticatedUserContext.Provider value={user}>
      <Outlet />
    </authenticatedUserContext.Provider>
  )
}
