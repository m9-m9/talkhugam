import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'

import {
  completeOnboarding,
  createInitialProfileForm,
  getProfile,
  profileFormSchema,
  type ProfileForm,
} from '../../entities/profile'
import { useAuthenticatedUser } from '../../features/auth'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { trackAnalyticsEvent } from '../../shared/analytics'
import { LoadingSpinner } from '../../shared/ui/LoadingSpinner'
import { RetryState } from '../../shared/ui/RetryState'

const mbtiOptions = [
  'ISTJ',
  'ISFJ',
  'INFJ',
  'INTJ',
  'ISTP',
  'ISFP',
  'INFP',
  'INTP',
  'ESTP',
  'ESFP',
  'ENFP',
  'ENTP',
  'ESTJ',
  'ESFJ',
  'ENFJ',
  'ENTJ',
] as const

/** 온보딩 페이지 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
export function OnboardingPage() {
  const navigate = useNavigate()
  const user = useAuthenticatedUser()
  const [isLoading, setIsLoading] = useState(true)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [profileErrorMessage, setProfileErrorMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const form = useForm<ProfileForm>({
    defaultValues: createInitialProfileForm(undefined),
    resolver: zodResolver(profileFormSchema),
  })

  useEffect(() => {
    /** 현재 사용자의 프로필을 불러와 온보딩 입력값을 채운다. */
    async function loadProfile() {
      const client = createSupabaseClient()
      setIsLoading(true)
      setProfileErrorMessage(null)

      try {
        const profile = await getProfile(client, user.id)
        form.reset({
          displayName: profile.displayName,
          bio: profile.bio ?? '',
          mbti: isMbti(profile.mbti) ? profile.mbti : null,
        })
      } catch {
        setProfileErrorMessage('프로필 정보를 불러오지 못했어요. 다시 시도해 주세요.')
      } finally {
        setIsLoading(false)
      }
    }

    void loadProfile()
  }, [form, loadAttempt, user.id])

  /** 초기 프로필 조회를 다시 요청한다. */
  function handleRetryProfile() {
    setIsLoading(true)
    setLoadAttempt((attempt) => attempt + 1)
  }

  /** 제출 요청이나 사용자 동작을 처리한다. */
  async function handleSubmit(values: ProfileForm) {
    setErrorMessage(null)
    form.clearErrors()

    const client = createSupabaseClient()

    try {
      await completeOnboarding(client, user.id, values)
      trackAnalyticsEvent('onboarding_completed')
      void navigate('/rooms', { replace: true })
    } catch {
      setErrorMessage('저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
    }
  }

  if (isLoading) return <OnboardingState message="프로필을 준비하고 있어요." />
  if (profileErrorMessage)
    return <OnboardingErrorState message={profileErrorMessage} onRetry={handleRetryProfile} />

  return (
    <main className="app-page bg-surface flex flex-col px-4 py-8">
      <header className="space-y-3">
        <p className="text-primary text-sm font-medium">Talk후감</p>
        <h1 className="text-ink text-3xl font-semibold">나를 간단히 소개해 주세요</h1>
        <p className="text-ink-subtle text-sm">독서방에서 함께 읽을 사람들이 볼 프로필이에요.</p>
      </header>

      <form className="mt-8 space-y-6" onSubmit={form.handleSubmit(handleSubmit)}>
        <Field label="이름" errorMessage={form.formState.errors.displayName?.message}>
          <input
            aria-invalid={Boolean(form.formState.errors.displayName)}
            className="focus:border-primary min-h-11 w-full rounded-md border border-black/10 bg-white px-3 text-sm outline-none"
            {...form.register('displayName')}
          />
        </Field>
        <Field label="한 줄 소개" errorMessage={form.formState.errors.bio?.message}>
          <textarea
            className="focus:border-primary min-h-24 w-full resize-none rounded-md border border-black/10 bg-white px-3 py-3 text-sm outline-none"
            maxLength={80}
            {...form.register('bio')}
          />
        </Field>
        <Field label="MBTI (선택)" errorMessage={form.formState.errors.mbti?.message}>
          <div className="relative">
            <select
              className="focus:border-primary min-h-11 w-full appearance-none rounded-md border border-black/10 bg-white px-3 pr-12 text-sm outline-none"
              {...form.register('mbti', {
                setValueAs: (value: string) => value || null,
              })}
            >
              <option value="">선택 안 함</option>
              {mbtiOptions.map((mbti) => (
                <option key={mbti} value={mbti}>
                  {mbti}
                </option>
              ))}
            </select>
            <svg
              aria-hidden="true"
              className="text-ink pointer-events-none absolute top-1/2 right-6 size-4 -translate-y-1/2"
              fill="none"
              viewBox="0 0 16 16"
            >
              <path
                d="m3 6 5 5 5-5"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
              />
            </svg>
          </div>
        </Field>
        {errorMessage ? (
          <p className="text-sm text-red-600" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <button
          className="bg-primary min-h-11 w-full rounded-md px-4 text-sm font-semibold text-white disabled:opacity-50"
          disabled={form.formState.isSubmitting}
          type="submit"
        >
          {form.formState.isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <LoadingSpinner label="프로필을 저장하고 있어요." showLabel={false} size="xs" />
              저장하고 있어요…
            </span>
          ) : (
            '시작하기'
          )}
        </button>
      </form>
    </main>
  )
}

/** MBTI 상태인지 판별한다. */
function isMbti(value: string | null): value is (typeof mbtiOptions)[number] {
  return value !== null && mbtiOptions.includes(value as (typeof mbtiOptions)[number])
}

/** 입력 필드 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
function Field({
  children,
  errorMessage,
  label,
}: {
  children: React.ReactNode
  errorMessage: string | undefined
  label: string
}) {
  return (
    <label className="block space-y-2">
      <span className="text-ink text-sm font-medium">{label}</span>
      {children}
      {errorMessage ? <span className="text-sm text-red-600">{errorMessage}</span> : null}
    </label>
  )
}

/** 온보딩 상태 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
function OnboardingState({ message }: { message: string }) {
  return (
    <main className="app-page bg-surface flex items-center justify-center px-4">
      <LoadingSpinner label={message} />
    </main>
  )
}

/** 온보딩 프로필 조회 오류와 재시도 동작을 렌더링한다. */
function OnboardingErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <main className="app-page bg-surface flex items-center justify-center px-4">
      <RetryState message={message} onRetry={onRetry} />
    </main>
  )
}
