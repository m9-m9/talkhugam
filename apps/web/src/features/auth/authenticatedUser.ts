import { createContext, useContext } from 'react'

export type AuthenticatedUser = {
  appMetadata: unknown
  email: string | null
  id: string
}

export const authenticatedUserContext = createContext<AuthenticatedUser | null>(null)

export function useAuthenticatedUser(): AuthenticatedUser {
  const user = useContext(authenticatedUserContext)
  if (user === null) throw new Error('Authenticated user is unavailable')
  return user
}
