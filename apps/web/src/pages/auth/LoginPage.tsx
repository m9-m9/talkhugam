import { useState } from 'react'

import { createSupabaseClient } from '../../shared/api/supabaseClient'

type Provider = 'google' | 'kakao' | 'naver'

export function LoginPage() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  async function handleLogin(provider: Provider) {
    setErrorMessage(null)
    setIsPending(true)

    if (provider === 'naver') {
      window.location.assign(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/naver-oauth-start?return_to=${encodeURIComponent(`${window.location.origin}/auth/callback`)}`,
      )
      return
    }

    const response = await createSupabaseClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })

    if (response.error) setErrorMessage('로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.')
    setIsPending(false)
  }

  return (
    <main className="bg-surface mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-8 px-6">
      <div className="space-y-3">
        <p className="text-primary text-sm font-medium">Talk후감</p>
        <h1 className="text-ink text-3xl font-semibold">함께 읽은 순간을 오래 남겨요</h1>
        <p className="text-ink-subtle text-sm">
          가까운 사람들과 비공개 독서방에서 대화를 시작해요.
        </p>
      </div>
      <div className="space-y-3">
        {(['kakao', 'google', 'naver'] as const).map((provider) => (
          <button
            className="text-ink min-h-11 w-full rounded-md border border-black/10 bg-white px-4 text-sm font-medium disabled:opacity-50"
            disabled={isPending}
            key={provider}
            onClick={() => void handleLogin(provider)}
            type="button"
          >
            {provider === 'kakao' ? '카카오' : provider === 'google' ? 'Google' : '네이버'}로
            계속하기
          </button>
        ))}
      </div>
      {errorMessage ? (
        <p role="alert" className="text-sm text-red-600">
          {errorMessage}
        </p>
      ) : null}
    </main>
  )
}
