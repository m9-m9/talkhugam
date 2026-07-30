import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'

import { ActionButton, FieldButton, TextField, ToggleButton } from '@seed-design/react'

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
import { BrandLoadingSpinner } from '../../shared/ui/LoadingSpinner'
import { BottomSheet } from '../../shared/ui/BottomSheet'
import { FormField } from '../../shared/ui/FormField'
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
  const [isMbtiSheetOpen, setIsMbtiSheetOpen] = useState(false)
  const mbtiFieldButtonRef = useRef<HTMLButtonElement>(null)
  const form = useForm<ProfileForm>({
    defaultValues: createInitialProfileForm(undefined),
    resolver: zodResolver(profileFormSchema),
  })
  const watchedMbti = useWatch({ control: form.control, name: 'mbti' })
  const selectedMbti = watchedMbti ?? 'none'

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

  /** MBTI 선택 시트를 열어 선택지를 별도 레이어에 표시한다. */
  function handleOpenMbtiSheet() {
    setIsMbtiSheetOpen(true)
  }

  /** MBTI 선택 시트를 닫고 원래 입력 필드에 키보드 포커스를 돌려준다. */
  function handleCloseMbtiSheet() {
    setIsMbtiSheetOpen(false)
  }

  /** MBTI 선택을 폼 상태에 반영하고 시트를 닫는다. */
  function handleMbtiOptionSelect(value: string) {
    if (value !== 'none' && !isMbti(value)) return

    form.setValue('mbti', value === 'none' ? null : value, {
      shouldDirty: true,
      shouldValidate: true,
    })
    setIsMbtiSheetOpen(false)
    window.setTimeout(() => mbtiFieldButtonRef.current?.focus(), 200)
  }

  if (isLoading) return <OnboardingState message="프로필을 준비하고 있어요." />
  if (profileErrorMessage)
    return <OnboardingErrorState message={profileErrorMessage} onRetry={handleRetryProfile} />

  return (
    <main className="app-page bg-surface flex flex-col px-4 py-8">
      <header className="space-y-3">
        <p className="text-primary text-sm font-medium">Talk후감</p>
        <h1 className="text-ink text-3xl font-semibold">나를 간단히 소개해 주세요</h1>
        <p className="text-ink-subtle text-sm">책방에서 함께 읽을 사람들이 볼 프로필이에요.</p>
      </header>

      <form className="mt-8 space-y-6" onSubmit={form.handleSubmit(handleSubmit)}>
        <FormField
          errorMessage={form.formState.errors.displayName?.message}
          label="이름"
          name="displayName"
        >
          <TextField.Root>
            <TextField.Input {...form.register('displayName')} />
          </TextField.Root>
        </FormField>
        <FormField
          errorMessage={form.formState.errors.bio?.message}
          label="한 줄 소개"
          name="bio"
          optional
        >
          <TextField.Root>
            <TextField.Textarea autoresize={false} maxLength={80} {...form.register('bio')} />
          </TextField.Root>
        </FormField>
        <FieldButton.Root
          className="talkhugam-mbti-field"
          invalid={Boolean(form.formState.errors.mbti)}
          name="mbti"
        >
          <FieldButton.Header>
            <FieldButton.Label>
              MBTI <FieldButton.IndicatorText aria-hidden="true">선택</FieldButton.IndicatorText>
            </FieldButton.Label>
          </FieldButton.Header>
          <FieldButton.Control>
            <FieldButton.Button
              aria-label={`MBTI: ${getMbtiDisplayValue(watchedMbti)}`}
              onClick={handleOpenMbtiSheet}
              ref={mbtiFieldButtonRef}
              type="button"
            >
              <FieldButton.Value>{getMbtiDisplayValue(watchedMbti)}</FieldButton.Value>
              <FieldButton.SuffixIcon
                svg={
                  <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
                    <path
                      d="m6 9 6 6 6-6"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                    />
                  </svg>
                }
              />
            </FieldButton.Button>
          </FieldButton.Control>
        </FieldButton.Root>
        {errorMessage ? (
          <p className="text-sm text-red-600" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <ActionButton
          className="talkhugam-primary-action w-full"
          disabled={form.formState.isSubmitting}
          loading={form.formState.isSubmitting}
          size="large"
          type="submit"
          variant="brandSolid"
        >
          {form.formState.isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <BrandLoadingSpinner label="프로필을 저장하고 있어요." showLabel={false} size="xs" />
              저장하고 있어요…
            </span>
          ) : (
            '시작하기'
          )}
        </ActionButton>
      </form>
      {isMbtiSheetOpen ? (
        <BottomSheet
          onClose={handleCloseMbtiSheet}
          returnFocusRef={mbtiFieldButtonRef}
          title="MBTI 선택"
        >
          <div aria-label="MBTI 선택지" className="grid grid-cols-3 gap-2" role="group">
            {['none', ...mbtiOptions].map((mbti) => (
              <ToggleButton
                className="talkhugam-foundation-toggle w-full"
                key={mbti}
                onClick={() => handleMbtiOptionSelect(mbti)}
                pressed={selectedMbti === mbti}
                variant="neutralWeak"
              >
                {mbti === 'none' ? '선택 안 함' : mbti}
              </ToggleButton>
            ))}
          </div>
        </BottomSheet>
      ) : null}
    </main>
  )
}

/** MBTI 상태인지 판별한다. */
function isMbti(value: string | null): value is (typeof mbtiOptions)[number] {
  return value !== null && mbtiOptions.includes(value as (typeof mbtiOptions)[number])
}

/** MBTI 저장값을 입력 필드와 보조 기술에 표시할 문구로 바꾼다. */
function getMbtiDisplayValue(value: ProfileForm['mbti']) {
  return value ?? '선택 안 함'
}

/** 온보딩 상태 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
function OnboardingState({ message }: { message: string }) {
  return (
    <main className="app-page bg-surface flex items-center justify-center px-4">
      <BrandLoadingSpinner label={message} />
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
