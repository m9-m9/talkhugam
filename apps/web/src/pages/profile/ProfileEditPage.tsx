import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'

import {
  getProfile,
  profileFormSchema,
  type ProfileForm,
  updateProfile,
} from '../../entities/profile'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { LoadingSpinner } from '../../shared/ui/LoadingSpinner'

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

export function ProfileEditPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [profileId, setProfileId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const form = useForm<ProfileForm>({
    defaultValues: { displayName: '', bio: '', mbti: null },
    resolver: zodResolver(profileFormSchema),
  })
  const profileQuery = useQuery({
    enabled: Boolean(profileId),
    queryFn: () => getProfile(createSupabaseClient(), profileId ?? ''),
    queryKey: ['profile', profileId],
  })

  useEffect(() => {
    async function loadSession() {
      const response = await createSupabaseClient().auth.getUser()
      if (response.error || !response.data.user) {
        void navigate('/', { replace: true })
        return
      }

      setProfileId(response.data.user.id)
    }

    void loadSession()
  }, [navigate])

  useEffect(() => {
    if (!profileQuery.data) return

    form.reset({
      displayName: profileQuery.data.displayName,
      bio: profileQuery.data.bio ?? '',
      mbti: isMbti(profileQuery.data.mbti) ? profileQuery.data.mbti : null,
    })
  }, [form, profileQuery.data])

  async function handleSubmit(values: ProfileForm) {
    if (!profileId) return

    setErrorMessage(null)
    try {
      await updateProfile(createSupabaseClient(), profileId, values)
      await queryClient.invalidateQueries({ queryKey: ['profile', profileId] })
      void navigate('/profile', { replace: true })
    } catch {
      setErrorMessage('저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
    }
  }

  if (!profileId || profileQuery.isPending)
    return <ProfileEditState message="프로필을 준비하고 있어요." />
  if (profileQuery.isError) return <ProfileEditState message="프로필 정보를 불러오지 못했어요." />

  return (
    <main className="app-page bg-surface px-6 py-8">
      <button
        className="text-ink-subtle -ml-3 min-h-11 px-3 text-sm"
        onClick={() => void navigate('/profile')}
        type="button"
      >
        ← 내 정보
      </button>
      <header className="mt-3">
        <p className="text-primary text-sm font-medium">프로필</p>
        <h1 className="text-ink mt-2 text-2xl font-bold">프로필 편집</h1>
        <p className="text-ink-subtle mt-2 text-sm">독서방에서 함께 읽는 사람들에게 보여요.</p>
      </header>

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
          disabled={form.formState.isSubmitting}
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

function isMbti(value: string | null): value is (typeof mbtiOptions)[number] {
  return value !== null && mbtiOptions.includes(value as (typeof mbtiOptions)[number])
}

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

function ProfileEditState({ message }: { message: string }) {
  return (
    <main className="app-page bg-surface flex items-center justify-center px-6">
      <LoadingSpinner label={message} />
    </main>
  )
}
