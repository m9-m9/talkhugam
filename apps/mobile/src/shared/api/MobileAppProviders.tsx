import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useState } from 'react'
import type { PropsWithChildren } from 'react'

import { createMobileSupabaseClient } from './mobileSupabaseClient'

const MobileSessionProfileIdContext = createContext<string | null>(null)

/** 인증 계정 경계에 맞춰 서버 캐시를 분리하고 하위 화면에 현재 프로필 식별자를 제공한다. */
export function MobileAppProviders({ children }: PropsWithChildren): React.JSX.Element {
  const [queryClient] = useState(() => new QueryClient())
  const [client] = useState(createMobileSupabaseClient)
  const [profileId, setProfileId] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    let hasReceivedAuthEvent = false

    /** 계정이 바뀌거나 로그아웃되면 이전 회원 전용 서버 캐시를 즉시 제거한다. */
    function handleProfileIdChange(nextProfileId: string | null): void {
      setProfileId((currentProfileId) => {
        if (currentProfileId === nextProfileId) return currentProfileId

        queryClient.clear()
        return nextProfileId
      })
    }

    /** Supabase 인증 이벤트에서 현재 세션의 계정 식별자만 추출해 캐시 경계를 갱신한다. */
    function handleSessionChange(_event: AuthChangeEvent, session: Session | null): void {
      hasReceivedAuthEvent = true
      handleProfileIdChange(session?.user.id ?? null)
    }

    /** 인증 이벤트가 아직 오지 않은 경우에만 저장 세션으로 초기 계정 경계를 설정한다. */
    async function restoreInitialProfileId(): Promise<void> {
      const response = await client.auth.getUser()
      if (response.error || !isMounted || hasReceivedAuthEvent) return

      handleProfileIdChange(response.data.user?.id ?? null)
    }

    void restoreInitialProfileId()
    const { data } = client.auth.onAuthStateChange(handleSessionChange)

    return () => {
      isMounted = false
      data.subscription.unsubscribe()
    }
  }, [client, queryClient])

  return (
    <QueryClientProvider client={queryClient}>
      <MobileSessionProfileIdContext.Provider value={profileId}>
        {children}
      </MobileSessionProfileIdContext.Provider>
    </QueryClientProvider>
  )
}

/** 현재 인증 계정의 UUID를 반환하고 세션을 확인하는 동안에는 null을 반환한다. */
export function useMobileSessionProfileId(): string | null {
  return useContext(MobileSessionProfileIdContext)
}
