import { useState } from 'react'

import { getClientEnv } from '../../app/env'
import { createSupabaseClient } from '../../shared/api/supabaseClient'

type Provider = 'google' | 'kakao' | 'naver'
function createNaverBridgeStartUrl(supabaseUrl: string, origin: string): string {
  const returnTo = encodeURIComponent(`${origin}/auth/callback`)
  return `${supabaseUrl}/functions/v1/naver-oauth-start?return_to=${returnTo}`
}

function GoogleLogo() {
  return (
    <svg aria-hidden="true" height="18" viewBox="0 0 18 18" width="18">
      <path
        d="M17.64 9.205c0-.639-.057-1.254-.164-1.845H9v3.49h4.844a4.14 4.14 0 0 1-1.796 2.715v2.26h2.909c1.703-1.568 2.683-3.877 2.683-6.62Z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.175l-2.908-2.26c-.806.54-1.838.86-3.048.86-2.345 0-4.33-1.584-5.037-3.71H.956v2.334A9 9 0 0 0 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.963 10.715A5.41 5.41 0 0 1 3.681 9c0-.595.102-1.174.282-1.715V4.951H.956A9 9 0 0 0 0 9c0 1.452.348 2.827.956 4.049l3.007-2.334Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.574c1.322 0 2.51.455 3.444 1.348l2.583-2.584C13.463.884 11.426 0 9 0A9 9 0 0 0 .956 4.951l3.007 2.334C4.67 5.158 6.655 3.574 9 3.574Z"
        fill="#EA4335"
      />
    </svg>
  )
}

function KakaoLogo() {
  return (
    <svg aria-hidden="true" height="20" viewBox="0 0 20 20" width="20">
      <path
        d="M10 2.5c-4.142 0-7.5 2.67-7.5 5.964 0 2.134 1.414 4.016 3.54 5.074l-.747 2.757 3.213-2.116c.486.064.985.097 1.494.097 4.142 0 7.5-2.67 7.5-5.964S14.142 2.5 10 2.5Z"
        fill="currentColor"
      />
    </svg>
  )
}

function NaverLogo() {
  return (
    <svg aria-hidden="true" height="20" viewBox="0 0 20 20" width="20">
      <path
        d="M3 2.5h3.38l4.36 7.126V2.5H14v15h-3.38L6.26 10.374V17.5H3v-15Z"
        fill="currentColor"
      />
    </svg>
  )
}

type SocialLoginButtonProps = {
  disabled: boolean
  onClick: () => void
  provider: Provider
}

function SocialLoginButton({ disabled, onClick, provider }: SocialLoginButtonProps) {
  if (provider === 'kakao') {
    return (
      <button
        aria-label="카카오로 로그인"
        className="text-ink flex h-12 w-full items-center justify-center gap-3 rounded-md bg-[#fee500] px-4 text-sm font-medium disabled:opacity-50"
        disabled={disabled}
        onClick={onClick}
        type="button"
      >
        <KakaoLogo />
        카카오로 계속하기
      </button>
    )
  }

  if (provider === 'naver') {
    return (
      <button
        aria-label="네이버로 로그인"
        className="flex h-12 w-full items-center justify-center gap-3 rounded-md bg-[#03c75a] px-4 text-sm font-medium text-white disabled:opacity-50"
        disabled={disabled}
        onClick={onClick}
        type="button"
      >
        <NaverLogo />
        네이버로 계속하기
      </button>
    )
  }

  return (
    <button
      className="text-ink flex h-12 w-full items-center justify-center gap-3 rounded-md border border-[#747775] bg-white px-4 text-sm font-medium disabled:opacity-50"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <GoogleLogo />
      Google로 계속하기
    </button>
  )
}

export function LoginPage() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  async function handleLogin(provider: Provider) {
    setErrorMessage(null)
    setIsPending(true)

    if (provider === 'naver') {
      const { VITE_SUPABASE_URL } = getClientEnv()
      window.location.assign(createNaverBridgeStartUrl(VITE_SUPABASE_URL, window.location.origin))
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
    <main className="app-page bg-surface flex flex-col justify-center gap-12 px-6">
      <div className="space-y-4">
        <p className="text-primary text-sm font-medium">Talk후감</p>
        <h1 className="text-ink text-3xl font-semibold break-keep">
          읽고 느낀 마음을
          <br />
          함께 나눠요
        </h1>
        <p className="text-ink-subtle text-sm">
          같은 책을 읽고 느낀 점을 편하게 나누는 독서방이에요.
        </p>
      </div>
      <div className="space-y-3">
        {(['kakao', 'google', 'naver'] as const).map((provider) => (
          <SocialLoginButton
            disabled={isPending}
            key={provider}
            onClick={() => void handleLogin(provider)}
            provider={provider}
          />
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
