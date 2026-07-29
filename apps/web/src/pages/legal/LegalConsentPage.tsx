import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { ActionButton, Checkbox } from '@seed-design/react'

import { getRequiredLegalDocuments, saveRequiredLegalConsents } from '../../entities/legal'
import { getOnboardingCompletedAt } from '../../entities/profile'
import { useAuthenticatedUser } from '../../features/auth'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { AppHeader } from '../../shared/ui/AppHeader'
import { BrandLoadingSpinner } from '../../shared/ui/LoadingSpinner'

/** 필수 약관과 개인정보처리방침 동의를 수집한다. */
export function LegalConsentPage() {
  const navigate = useNavigate()
  const user = useAuthenticatedUser()
  const [agreedDocumentIds, setAgreedDocumentIds] = useState<Set<string>>(() => new Set())
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const documents = getRequiredLegalDocuments()
  const hasAgreedToAll = agreedDocumentIds.size === documents.length

  /** 정책 문서 동의 여부를 전환한다. */
  function handleToggleDocument(documentId: string) {
    setAgreedDocumentIds((current) => {
      const next = new Set(current)
      if (next.has(documentId)) next.delete(documentId)
      else next.add(documentId)
      return next
    })
  }

  /** 필수 정책 동의를 저장하고 사용자에게 맞는 다음 화면으로 이동한다. */
  async function handleSubmit() {
    if (!hasAgreedToAll || isSubmitting) return
    setErrorMessage(null)
    setIsSubmitting(true)
    const client = createSupabaseClient()

    try {
      await saveRequiredLegalConsents(client)
      const completedAt = await getOnboardingCompletedAt(client, user.id)
      void navigate(completedAt === null ? '/onboarding' : '/rooms', { replace: true })
    } catch {
      setErrorMessage('동의를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
      setIsSubmitting(false)
    }
  }

  return (
    <main className="app-page bg-surface px-4 pb-12">
      <AppHeader onBack={() => void navigate('/', { replace: true })} title="서비스 이용 동의" />
      <section className="pt-8">
        <p className="text-primary text-sm font-medium">Talk후감 시작하기</p>
        <h1 className="text-ink mt-2 text-2xl font-bold">함께 읽기 전에 약속을 확인해요</h1>
        <p className="text-ink-subtle mt-3 text-sm leading-6">
          서비스 이용에 꼭 필요한 두 가지 약관이에요. 마케팅 알림 동의는 받지 않아요.
        </p>
      </section>
      <fieldset className="mt-8 space-y-3">
        <legend className="sr-only">필수 정책 동의</legend>
        {documents.map((document) => {
          const isChecked = agreedDocumentIds.has(document.id)
          return (
            <Checkbox.Root
              checked={isChecked}
              className="border-border flex min-h-16 w-full items-center gap-3 rounded-md border bg-white px-3 py-3"
              key={document.id}
              onCheckedChange={() => handleToggleDocument(document.id)}
              size="large"
            >
              <Checkbox.HiddenInput aria-label={`${document.shortTitle}에 동의합니다.`} />
              <Checkbox.Control>
                <Checkbox.Indicator
                  checked={
                    <svg aria-hidden="true" fill="none" viewBox="0 0 16 16">
                      <path
                        d="m3.25 8.25 3 3 6.5-6.5"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.75"
                      />
                    </svg>
                  }
                />
              </Checkbox.Control>
              <Checkbox.Label className="min-w-0 flex-1">
                <span className="text-ink block text-sm font-semibold">
                  [필수] {document.shortTitle} 동의
                </span>
                <span className="text-ink-subtle mt-1 block text-xs">
                  시행일 · {document.version}
                </span>
              </Checkbox.Label>
              <Link
                className="text-primary min-h-11 shrink-0 content-center text-sm font-medium"
                onClick={(event) => event.stopPropagation()}
                to={`/legal/${document.id}`}
              >
                보기
              </Link>
            </Checkbox.Root>
          )
        })}
      </fieldset>
      {errorMessage ? (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <ActionButton
        className="talkhugam-primary-action mt-6 w-full"
        disabled={!hasAgreedToAll || isSubmitting}
        loading={isSubmitting}
        onClick={() => void handleSubmit()}
        size="large"
        type="button"
        variant="brandSolid"
      >
        {isSubmitting ? (
          <BrandLoadingSpinner label="동의를 저장하고 있어요." showLabel={false} size="xs" />
        ) : (
          '동의하고 계속하기'
        )}
      </ActionButton>
    </main>
  )
}
