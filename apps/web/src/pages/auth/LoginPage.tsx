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

type SocialLoginButtonProps = {
  disabled: boolean
  onClick: () => void
  provider: Provider
}

/** 소셜 로그인 버튼 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
function SocialLoginButton({ disabled, onClick, provider }: SocialLoginButtonProps) {
  const assetSrc = getSocialLoginAsset(provider)
  const providerLabel =
    provider === 'kakao'
      ? '카카오 로그인'
      : provider === 'naver'
        ? '네이버 로그인'
        : 'Google 계정으로 계속'

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
      <img
        alt=""
        className={`talkhugam-social-login-button__asset talkhugam-social-login-button__asset--${provider}`}
        src={assetSrc}
      />
    </ActionButton>
  )
}

/** 제공자별로 내려받은 공식 로그인 이미지 경로를 반환한다. */
function getSocialLoginAsset(provider: Provider): string {
  if (provider === 'kakao') return '/brand/social/kakao-login.png'
  if (provider === 'naver') return '/brand/social/naver-login.png'

  return '/brand/social/google-login.svg'
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
