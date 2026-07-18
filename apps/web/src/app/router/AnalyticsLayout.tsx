import { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import { getClientEnv } from '../env'
import { loadClarity, loadGa4, trackPageView } from '../../shared/analytics'

/** 앱 전체의 SPA 화면 이동을 한 번씩만 GA4 페이지 조회로 기록한다. */
export function AnalyticsLayout() {
  const location = useLocation()
  const lastTrackedLocationRef = useRef<string | null>(null)

  useEffect(() => {
    const clientEnv = getClientEnv()
    loadGa4(clientEnv.VITE_GA_MEASUREMENT_ID)
    loadClarity(clientEnv.VITE_CLARITY_PROJECT_ID)
  }, [])

  useEffect(() => {
    const locationKey = `${location.pathname}${location.search}`
    if (lastTrackedLocationRef.current === locationKey) return
    trackPageView(locationKey, document.title)
    lastTrackedLocationRef.current = locationKey
  }, [location.pathname, location.search])

  return <Outlet />
}
