import { createContext, useContext } from 'react'

export type AuthenticatedUser = {
  appMetadata: unknown
  email: string | null
  id: string
  userMetadata: unknown
}

export const authenticatedUserContext = createContext<AuthenticatedUser | null>(null)

/** 인증 사용자 상태와 사용자 동작을 재사용 가능한 hook으로 제공한다. */
export function useAuthenticatedUser(): AuthenticatedUser {
  const user = useContext(authenticatedUserContext)
  if (user === null) throw new Error('Authenticated user is unavailable')
  return user
}
