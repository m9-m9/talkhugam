import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { ActionButton } from '@seed-design/react'

import { getClientEnv } from '../../app/env'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { KakaoLogo } from '../../shared/ui/KakaoLogo'
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

type SocialLoginButtonProps = {
  disabled: boolean
  onClick: () => void
  provider: Provider
}

/** 소셜 로그인 버튼 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
function SocialLoginButton({ disabled, onClick, provider }: SocialLoginButtonProps) {
  const providerLabel = getSocialLoginLabel(provider)

  return (
    <ActionButton
      aria-label={providerLabel}
      className={`talkhugam-social-login-button talkhugam-social-login-button--${provider} !justify-center`}
      disabled={disabled}
      onClick={onClick}
      size="medium"
      type="button"
      variant="neutralSolid"
    >
      <SocialLoginButtonContent provider={provider} />
    </ActionButton>
  )
}

/** 제공사별 공식 로고와 현지화한 로그인 문구를 같은 간격으로 묶어 렌더링한다. */
function SocialLoginButtonContent({ provider }: Pick<SocialLoginButtonProps, 'provider'>) {
  const label = getSocialLoginLabel(provider)

  return (
    <span className="talkhugam-social-login-button__content">
      <SocialLoginMark provider={provider} />
      <span
        className={
          provider === 'google'
            ? 'talkhugam-social-login-button__google-label'
            : 'talkhugam-social-login-button__provider-label'
        }
      >
        {label}
      </span>
    </span>
  )
}

/** 제공사별 공식 로고 마크만 로그인 버튼에 렌더링한다. */
function SocialLoginMark({ provider }: Pick<SocialLoginButtonProps, 'provider'>) {
  if (provider === 'kakao') {
    return <KakaoLogo aria-hidden="true" className="talkhugam-social-login-button__kakao-mark" />
  }

  if (provider === 'naver') {
    return (
      <img
        alt=""
        className="talkhugam-social-login-button__naver-mark"
        src="/brand/social/naver-icon.png"
      />
    )
  }

  return (
    <span aria-hidden="true" className="talkhugam-social-login-button__google-mark">
      <img alt="" src="/brand/social/google-login.svg" />
    </span>
  )
}

/** 제공사별 로그인 동작을 설명하는 공식 또는 현지화 문구를 반환한다. */
function getSocialLoginLabel(provider: Provider): string {
  if (provider === 'kakao') return '카카오 로그인'
  if (provider === 'naver') return '네이버 로그인'

  return '구글 로그인'
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
