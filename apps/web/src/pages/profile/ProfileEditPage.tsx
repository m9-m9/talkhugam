import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ChangeEvent } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'

import {
  getProfile,
  profileFormSchema,
  type ProfileForm,
  uploadProfileAvatar,
  updateProfile,
  validateProfileAvatarFile,
} from '../../entities/profile'
import { useAuthenticatedUser } from '../../features/auth'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { AppHeader } from '../../shared/ui/AppHeader'
import { LoadingSpinner } from '../../shared/ui/LoadingSpinner'
import { ProfileAvatar } from '../../shared/ui/ProfileAvatar'
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

/** 프로필 편집 페이지 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
export function ProfileEditPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const profileId = useAuthenticatedUser().id
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const form = useForm<ProfileForm>({
    defaultValues: { displayName: '', bio: '', mbti: null },
    resolver: zodResolver(profileFormSchema),
  })
  const profileQuery = useQuery({
    queryFn: () => getProfile(createSupabaseClient(), profileId),
    queryKey: ['profile', profileId],
  })
  const isSaveDisabled = form.formState.isSubmitting || (!form.formState.isDirty && !avatarFile)

  useEffect(() => {
    if (!profileQuery.data) return

    form.reset({
      displayName: profileQuery.data.displayName,
      bio: profileQuery.data.bio ?? '',
      mbti: isMbti(profileQuery.data.mbti) ? profileQuery.data.mbti : null,
    })
  }, [form, profileQuery.data])

  /** 선택 사진의 임시 URL은 다음 선택 또는 화면 이탈 시 브라우저 메모리에서 해제한다. */
  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl)
    }
  }, [avatarPreviewUrl])

  /** 제출 요청이나 사용자 동작을 처리한다. */
  async function handleSubmit(values: ProfileForm) {
    setErrorMessage(null)
    try {
      const client = createSupabaseClient()
      const avatarPath = avatarFile
        ? await uploadProfileAvatar(client, profileId, avatarFile)
        : undefined
      await updateProfile(client, profileId, { ...values, ...(avatarPath ? { avatarPath } : {}) })
      await queryClient.invalidateQueries({ queryKey: ['profile', profileId] })
      void navigate('/profile', { replace: true })
    } catch {
      setErrorMessage('저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
    }
  }

  if (profileQuery.isPending || profileQuery.isFetching)
    return <ProfileEditState message="프로필을 준비하고 있어요." />
  if (profileQuery.isError)
    return (
      <ProfileEditErrorState
        message="프로필 정보를 불러오지 못했어요."
        onRetry={handleRetryProfile}
      />
    )

  /** 프로필 조회를 다시 요청한다. */
  function handleRetryProfile() {
    void profileQuery.refetch()
  }

  /** 선택한 사진을 검증하고 저장 전 미리보기 상태로 반영한다. */
  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    const validation = validateProfileAvatarFile(file)
    if (!validation.isValid) {
      setErrorMessage(validation.message)
      return
    }

    setErrorMessage(null)
    setAvatarFile(file)
    setAvatarPreviewUrl(createAvatarPreviewUrl(file))
  }

  return (
    <main className="app-page bg-surface px-4 pb-8">
      <AppHeader onBack={() => void navigate('/profile')} title="프로필 편집" />
      <header className="mt-8">
        <p className="text-primary text-sm font-medium">프로필</p>
        <h1 className="text-ink mt-2 text-2xl font-bold">프로필 편집</h1>
        <p className="text-ink-subtle mt-2 text-sm">내 소개와 독서 취향을 알려주세요.</p>
      </header>

      <section aria-label="프로필 사진" className="mt-8 flex items-center gap-4">
        <ProfileAvatar
          alt="선택한 프로필 사진"
          displayName={profileQuery.data.displayName}
          size="lg"
          src={avatarPreviewUrl ?? profileQuery.data.avatarUrl}
        />
        <div className="min-w-0">
          <label className="border-ink/10 hover:bg-surface-muted focus-within:ring-primary flex min-h-11 w-fit cursor-pointer items-center rounded-md border bg-white px-4 text-sm font-semibold focus-within:ring-2 focus-within:ring-offset-2 focus-within:outline-none">
            사진 변경
            <input
              accept="image/jpeg,image/png,image/webp"
              aria-label="프로필 사진 변경"
              className="sr-only"
              onChange={handleAvatarChange}
              type="file"
            />
          </label>
          <p className="text-ink-subtle mt-2 text-xs">JPG, PNG, WebP · 최대 5MB</p>
        </div>
      </section>

      <form className="mt-8 space-y-6" onSubmit={form.handleSubmit(handleSubmit)}>
        <EditField errorMessage={form.formState.errors.displayName?.message} label="이름">
          <input
            aria-invalid={Boolean(form.formState.errors.displayName)}
            className="focus:border-primary min-h-11 w-full rounded-md border border-black/10 bg-white px-3 text-sm outline-none"
            {...form.register('displayName')}
          />
        </EditField>
        <EditField errorMessage={form.formState.errors.bio?.message} label="한 줄 소개">
          <textarea
            className="focus:border-primary min-h-24 w-full resize-none rounded-md border border-black/10 bg-white px-3 py-3 text-sm outline-none"
            maxLength={80}
            {...form.register('bio')}
          />
        </EditField>
        <EditField errorMessage={form.formState.errors.mbti?.message} label="MBTI (선택)">
          <div className="relative">
            <select
              className="focus:border-primary min-h-11 w-full appearance-none rounded-md border border-black/10 bg-white px-3 pr-12 text-sm outline-none"
              {...form.register('mbti', { setValueAs: (value: string) => value || null })}
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
        </EditField>
        {errorMessage ? (
          <p className="text-sm text-red-600" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <button
          className="bg-primary min-h-11 w-full rounded-md px-4 text-sm font-semibold text-white disabled:opacity-50"
          disabled={isSaveDisabled}
          type="submit"
        >
          {form.formState.isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <LoadingSpinner label="프로필을 저장하고 있어요." showLabel={false} size="xs" />
              저장하고 있어요…
            </span>
          ) : (
            '저장하기'
          )}
        </button>
      </form>
    </main>
  )
}

/** 브라우저가 지원하는 경우 선택 파일의 로컬 미리보기 URL을 생성해 반환한다. */
function createAvatarPreviewUrl(file: File): string | null {
  if (typeof URL.createObjectURL !== 'function') return null
  return URL.createObjectURL(file)
}

/** MBTI 상태인지 판별한다. */
function isMbti(value: string | null): value is (typeof mbtiOptions)[number] {
  return value !== null && mbtiOptions.includes(value as (typeof mbtiOptions)[number])
}

/** 편집 입력 필드 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
function EditField({
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

/** 프로필 편집 상태 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
function ProfileEditState({ message }: { message: string }) {
  return (
    <main className="app-page bg-surface flex items-center justify-center px-4">
      <LoadingSpinner label={message} />
    </main>
  )
}

/** 프로필 편집 조회 오류와 재시도 동작을 렌더링한다. */
function ProfileEditErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <main className="app-page bg-surface flex items-center justify-center px-4">
      <RetryState message={message} onRetry={onRetry} />
    </main>
  )
}
