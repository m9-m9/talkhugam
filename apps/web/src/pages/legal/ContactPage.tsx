import { Link } from 'react-router-dom'

import { getClientEnv } from '../../app/env'
import { AppHeader } from '../../shared/ui/AppHeader'

/** 이용약관, 개인정보처리방침, 문의 방법을 한곳에서 안내한다. */
export function ContactPage() {
  const supportEmail = getClientEnv().VITE_SUPPORT_EMAIL

  /** 현재 서비스 정보 화면에서 사용자를 직전 화면으로 되돌린다. */
  function handleGoBack() {
    window.history.back()
  }

  return (
    <main className="app-page bg-surface px-4 pb-12">
      <AppHeader onBack={handleGoBack} title="서비스 정보" />
      <section className="pt-8">
        <p className="text-primary text-sm font-medium">Talk후감</p>
        <h1 className="text-ink mt-2 text-2xl font-bold">서비스 정보</h1>
        <p className="text-ink-subtle mt-3 text-sm leading-6">
          이용에 필요한 정책과 문의 방법을 확인할 수 있어요.
        </p>
      </section>
      <section className="mt-8 space-y-3" aria-label="정책 문서">
        <Link
          className="border-border flex min-h-12 items-center justify-between rounded-md border bg-white px-4 text-sm font-medium"
          to="/legal/terms"
        >
          이용약관 <span aria-hidden="true">›</span>
        </Link>
        <Link
          className="border-border flex min-h-12 items-center justify-between rounded-md border bg-white px-4 text-sm font-medium"
          to="/legal/privacy"
        >
          개인정보처리방침 <span aria-hidden="true">›</span>
        </Link>
      </section>
      <section
        className="border-border mt-8 rounded-lg border bg-white p-4"
        aria-labelledby="contact-channel-heading"
      >
        <h2 className="text-ink text-base font-bold" id="contact-channel-heading">
          문의하기
        </h2>
        {supportEmail ? (
          <a
            className="text-primary mt-3 block min-h-11 content-center text-sm font-semibold"
            href={`mailto:${supportEmail}`}
          >
            {supportEmail}
          </a>
        ) : (
          <p className="talkhugam-balanced-copy text-ink-subtle mt-3 text-sm leading-6">
            문의 이메일은 출시 전에 안내됩니다.
          </p>
        )}
        <p className="text-ink-subtle mt-3 text-xs leading-5">
          계정 이메일, 사용 중인 로그인 수단, 발생한 화면과 시간을 함께 알려주시면 더 빠르게 확인할
          수 있어요. 비밀번호나 인증 코드는 보내지 마세요.
        </p>
      </section>
    </main>
  )
}
