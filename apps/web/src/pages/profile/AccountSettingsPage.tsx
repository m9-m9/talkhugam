import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { getProviderLabels } from '../../entities/profile'
import { createSupabaseClient } from '../../shared/api/supabaseClient'

type AccountIdentity = {
  email: string
  providers: string[]
}

export function AccountSettingsPage() {
  const navigate = useNavigate()
  const [account, setAccount] = useState<AccountIdentity | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSigningOut, setIsSigningOut] = useState(false)

  useEffect(() => {
    async function loadAccount() {
      const response = await createSupabaseClient().auth.getUser()
      if (response.error || !response.data.user) {
        void navigate('/', { replace: true })
        return
      }

      try {
        setAccount({
          email: response.data.user.email ?? '이메일 정보를 찾을 수 없어요',
          providers: getProviderLabels(response.data.user.app_metadata),
        })
      } catch {
        setErrorMessage('계정 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
      }
    }

    void loadAccount()
  }, [navigate])

  async function handleSignOut() {
    setErrorMessage(null)
    setIsSigningOut(true)

    const response = await createSupabaseClient().auth.signOut()
    if (response.error) {
      setErrorMessage('로그아웃하지 못했어요. 잠시 후 다시 시도해 주세요.')
      setIsSigningOut(false)
      return
    }

    void navigate('/', { replace: true })
  }

  if (!account && !errorMessage)
    return <AccountSettingsState message="계정 정보를 불러오고 있어요." />

  return (
    <main className="bg-surface mx-auto min-h-screen w-full max-w-md px-6 py-8">
      <button
        className="text-ink-subtle -ml-3 min-h-11 px-3 text-sm"
        onClick={() => void navigate('/profile')}
        type="button"
      >
        ← 내 정보
      </button>
      <header className="mt-3">
        <p className="text-primary text-sm font-medium">계정</p>
        <h1 className="text-ink mt-2 text-2xl font-bold">계정 설정</h1>
        <p className="text-ink-subtle mt-2 text-sm">로그인에 사용하는 계정 정보를 확인해요.</p>
      </header>

      {account ? (
        <section className="mt-8" aria-label="계정 정보">
          <dl className="border-ink/10 overflow-hidden rounded-lg border bg-white">
            <AccountDetail label="이메일" value={account.email} />
            <AccountDetail
              label="로그인 수단"
              value={
                account.providers.length > 0 ? account.providers.join(', ') : '확인할 수 없어요'
              }
            />
          </dl>
        </section>
      ) : null}

      {errorMessage ? (
        <p className="mt-6 text-sm text-red-600" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <section className="mt-12" aria-labelledby="sign-out-heading">
        <h2 className="text-ink text-base font-bold" id="sign-out-heading">
          로그인 관리
        </h2>
        <button
          className="border-ink/10 text-ink mt-4 min-h-11 w-full rounded-md border bg-white px-4 text-sm font-semibold disabled:opacity-50"
          disabled={isSigningOut}
          onClick={() => void handleSignOut()}
          type="button"
        >
          {isSigningOut ? '로그아웃하고 있어요…' : '로그아웃'}
        </button>
      </section>
    </main>
  )
}

function AccountDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-ink/10 flex flex-col gap-2 border-b px-4 py-4 last:border-b-0">
      <dt className="text-ink-subtle text-sm">{label}</dt>
      <dd className="text-ink text-sm break-all">{value}</dd>
    </div>
  )
}

function AccountSettingsState({ message }: { message: string }) {
  return (
    <main className="bg-surface mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-6">
      <p className="text-ink-subtle text-center text-sm" role="status">
        {message}
      </p>
    </main>
  )
}
