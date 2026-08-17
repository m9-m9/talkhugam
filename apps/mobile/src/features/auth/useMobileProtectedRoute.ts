import type { AuthDestination } from '@talkhugam/domain'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'

import { resolveMobileAuthDestination } from './resolveMobileAuthDestination'
import { createMobileSupabaseClient } from '../../shared/api/mobileSupabaseClient'

/** 인증된 사용자가 현재 경로에 접근 가능한지 확인하고 불가능한 경우 안전한 다음 경로로 이동한다. */
export function useMobileProtectedRoute(allowedDestination: AuthDestination): boolean {
  const router = useRouter()
  const [isAllowed, setIsAllowed] = useState(false)

  useEffect(() => {
    let isMounted = true

    /** 저장된 세션의 실제 접근 목적지를 조회해 현재 경로 노출 여부를 결정한다. */
    async function verifyRouteAccess(): Promise<void> {
      try {
        const destination = await resolveMobileAuthDestination(createMobileSupabaseClient())
        if (!isMounted) return

        if (destination === allowedDestination) {
          setIsAllowed(true)
          return
        }

        router.replace(destination)
      } catch {
        if (isMounted) router.replace('/')
      }
    }

    void verifyRouteAccess()

    return () => {
      isMounted = false
    }
  }, [allowedDestination, router])

  return isAllowed
}
