import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { ActionButton } from '@seed-design/react'

import { getClientEnv } from '../../app/env'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { BrandLoadingSpinner } from '../../shared/ui/LoadingSpinner'

type Provider = 'google' | 'kakao' | 'naver'

/** 계정 삭제 완료를 알리는 일회성 로그인 화면 상태인지 확인한다. */
function hasAccountDeletionCompleted(): boolean {
  return new URLSearchParams(window.location.search).get('account') === 'deleted'
}

/** 계정 삭제 완료 안내를 노출한 뒤 URL에서 일회성 상태 값을 제거한다. */
function clearAccountDeletionCompleted(): void {
  const url = new URL(window.location.href)
  url.searchParams.delete('account')
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

/** Naver OAuth 시작 Edge Function URL을 만든다. */
function createNaverBridgeStartUrl(supabaseUrl: string, origin: string): string {
  const returnTo = encodeURIComponent(`${origin}/auth/callback`)
  return `${supabaseUrl}/functions/v1/naver-oauth-start?return_to=${returnTo}`
}

/** Google 로고 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
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

/** Kakao 로고 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
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

/** Naver 로고 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
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

/** 소셜 로그인 버튼 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
function SocialLoginButton({ disabled, onClick, provider }: SocialLoginButtonProps) {
  if (provider === 'kakao') {
    return (
      <ActionButton
        aria-label="카카오로 로그인"
        className="talkhugam-social-login-button talkhugam-social-login-button--kakao"
        disabled={disabled}
        onClick={onClick}
        size="medium"
        type="button"
        variant="neutralSolid"
      >
        <span className="talkhugam-social-login-button__content">
          <span className="talkhugam-social-login-button__icon">
            <KakaoLogo />
          </span>
          <span>카카오로 계속하기</span>
        </span>
      </ActionButton>
    )
  }

  if (provider === 'naver') {
    return (
      <ActionButton
        aria-label="네이버로 로그인"
        className="talkhugam-social-login-button talkhugam-social-login-button--naver"
        disabled={disabled}
        onClick={onClick}
        size="medium"
        type="button"
        variant="neutralSolid"
      >
        <span className="talkhugam-social-login-button__content">
          <span className="talkhugam-social-login-button__icon">
            <NaverLogo />
          </span>
          <span>네이버로 계속하기</span>
        </span>
      </ActionButton>
    )
  }

  return (
    <ActionButton
      className="talkhugam-social-login-button talkhugam-social-login-button--google"
      disabled={disabled}
      onClick={onClick}
      size="medium"
      type="button"
      variant="neutralOutline"
    >
      <span className="talkhugam-social-login-button__content">
        <span className="talkhugam-social-login-button__icon">
          <GoogleLogo />
        </span>
        <span>Google로 계속하기</span>
      </span>
    </ActionButton>
  )
}

/** 로그인 페이지 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
export function LoginPage() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [wasAccountDeleted] = useState(hasAccountDeletionCompleted)

  useEffect(() => {
    if (wasAccountDeleted) clearAccountDeletionCompleted()
  }, [wasAccountDeleted])

  /** 로그인 요청이나 사용자 동작을 처리한다. */
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
    <main className="app-page talkhugam-login-page bg-surface flex items-center px-4 py-12">
      <section aria-label="Talk후감 로그인" className="talkhugam-login-content">
        <div className="space-y-4">
          <p className="text-primary text-sm font-medium">Talk후감</p>
          <h1 className="text-ink text-3xl font-semibold break-keep">
            읽고 느낀 마음을
            <br />
            함께 나눠요
          </h1>
          <p className="text-ink-subtle text-sm">
            같은 책을 읽고 느낀 점을 편하게 나누는 책방이에요.
          </p>
          {wasAccountDeleted ? (
            <p className="text-primary text-sm" role="status">
              계정 삭제 요청이 완료됐어요. Talk후감에 다시 오고 싶을 때 언제든 로그인해 주세요.
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          {(['kakao', 'google', 'naver'] as const).map((provider) => (
            <SocialLoginButton
              disabled={isPending}
              key={provider}
              onClick={() => void handleLogin(provider)}
              provider={provider}
            />
          ))}
        </div>
        <p className="text-ink-subtle text-center text-xs leading-5">
          계속하면{' '}
          <Link className="text-primary font-medium underline underline-offset-2" to="/legal/terms">
            이용약관
          </Link>{' '}
          및{' '}
          <Link
            className="text-primary font-medium underline underline-offset-2"
            to="/legal/privacy"
          >
            개인정보처리방침
          </Link>
          에 동의하게 됩니다.
        </p>
        {isPending ? <BrandLoadingSpinner label="로그인을 연결하고 있어요." size="sm" /> : null}
        {errorMessage ? (
          <p role="alert" className="text-sm text-red-600">
            {errorMessage}
          </p>
        ) : null}
      </section>
    </main>
  )
}
