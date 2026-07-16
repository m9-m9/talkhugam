import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { createSupabaseClient } from '../../shared/api/supabaseClient'

export function RoomsPage() {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function protectRoute() {
      const response = await createSupabaseClient().auth.getUser()
      if (response.error || !response.data.user) void navigate('/', { replace: true })
      setIsLoading(false)
    }

    void protectRoute()
  }, [navigate])

  if (isLoading) {
    return <main className="bg-surface min-h-screen" />
  }

  return (
    <main className="bg-surface mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-8">
      <p className="text-primary text-sm font-medium">Talk후감</p>
      <h1 className="text-ink mt-3 text-3xl font-semibold">내 독서방</h1>
      <p className="text-ink-subtle mt-3 text-sm">독서방 목록 화면은 다음 티켓에서 연결해요.</p>
    </main>
  )
}
