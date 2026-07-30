import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { ActionButton, TextField } from '@seed-design/react'

import {
  getProfile,
  getProfileAvatarUrl,
  profileFormSchema,
  type ProfileForm,
  uploadProfileAvatar,
  updateProfile,
} from '../../entities/profile'
import { useAuthenticatedUser } from '../../features/auth'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { AppHeader } from '../../shared/ui/AppHeader'
import { FormField } from '../../shared/ui/FormField'
import { BrandLoadingSpinner } from '../../shared/ui/LoadingSpinner'
import { ProfileAvatar } from '../../shared/ui/ProfileAvatar'
import { RetryState } from '../../shared/ui/RetryState'

/** 프로필 편집 페이지 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
export function ProfileEditPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const profileId = useAuthenticatedUser().id
  const client = createSupabaseClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const form = useForm<ProfileForm>({
    defaultValues: { displayName: '', bio: '' },
    resolver: zodResolver(profileFormSchema),
  })
  const profileQuery = useQuery({
    queryFn: () => getProfile(client, profileId),
    queryKey: ['profile', profileId],
  })
  const avatarUrlQuery = useQuery({
    enabled: Boolean(profileQuery.data?.avatarPath),
    queryFn: getAvatarUrl,
    queryKey: [
      'profile-avatar-url',
      profileId,
      profileQuery.data?.avatarPath,
      profileQuery.data?.updatedAt,
    ],
  })
  const avatarUploadMutation = useMutation({
    mutationFn: uploadAvatar,
    onError: handleAvatarUploadError,
    onSuccess: handleAvatarUploadSuccess,
  })
  const isSaveDisabled = form.formState.isSubmitting || !form.formState.isDirty

  useEffect(() => {
    if (!profileQuery.data) return

    form.reset({
      displayName: profileQuery.data.displayName,
      bio: profileQuery.data.bio ?? '',
    })
  }, [form, profileQuery.data])

  /** 제출 요청이나 사용자 동작을 처리한다. */
  async function handleSubmit(values: ProfileForm) {
    setErrorMessage(null)
    try {
      await updateProfile(client, profileId, values)
      await queryClient.invalidateQueries({ queryKey: ['profile', profileId] })
      void navigate('/profile', { replace: true })
    } catch {
      setErrorMessage('저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
    }
  }

  /** private Storage에 현재 사용자의 사진을 업로드하고 객체 경로를 저장한다. */
  async function uploadAvatar(file: File) {
    return uploadProfileAvatar(client, profileId, file)
  }

  /** 사진 객체 경로와 갱신 시각으로 접근 가능한 임시 URL을 조회한다. */
  async function getAvatarUrl() {
    return getProfileAvatarUrl(client, profileQuery.data?.avatarPath ?? null)
  }

  /** 사진 업로드 후 프로필과 임시 URL을 최신 상태로 갱신한다. */
  async function handleAvatarUploadSuccess() {
    await queryClient.invalidateQueries({ queryKey: ['profile', profileId] })
    await queryClient.invalidateQueries({ queryKey: ['profile-avatar-url', profileId] })
  }

  /** 사진 업로드의 검증 또는 네트워크 실패를 사용자가 이해할 문구로 표시한다. */
  function handleAvatarUploadError(error: Error) {
    setErrorMessage(error.message || '사진을 올리지 못했어요. 잠시 후 다시 시도해 주세요.')
  }

  /** 숨겨진 파일 선택기를 열어 사진 변경을 시작한다. */
  function handleSelectAvatar() {
    fileInputRef.current?.click()
  }

  /** 선택한 사진을 즉시 업로드하고 같은 파일도 다시 선택할 수 있게 입력값을 비운다. */
  function handleAvatarInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setErrorMessage(null)
    avatarUploadMutation.mutate(file)
  }

  if (profileQuery.isPending) return <ProfileEditState message="프로필을 준비하고 있어요." />
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

  return (
    <main className="app-page bg-surface px-4 pb-8">
      <AppHeader onBack={() => void navigate('/profile')} title="프로필 편집" />
      <header className="mt-8">
        <p className="text-primary text-sm font-medium">프로필</p>
        <h1 className="text-ink mt-2 text-2xl font-bold">프로필 편집</h1>
        <p className="text-ink-subtle mt-2 text-sm">나를 소개할 한 줄을 적어 주세요.</p>
      </header>

      <section aria-label="프로필 사진" className="mt-8 flex items-center gap-4">
        <ProfileAvatar
          avatarUrl={avatarUrlQuery.data ?? null}
          displayName={profileQuery.data?.displayName ?? ''}
        />
        <div>
          <ActionButton
            className="talkhugam-foundation-action--outline"
            disabled={avatarUploadMutation.isPending}
            onClick={handleSelectAvatar}
            size="medium"
            type="button"
            variant="neutralOutline"
          >
            {avatarUploadMutation.isPending ? '사진 올리는 중…' : '사진 변경'}
          </ActionButton>
          <p className="text-ink-subtle mt-2 text-xs">JPG, PNG, WebP · 최대 5MB</p>
        </div>
        <input
          accept="image/jpeg,image/png,image/webp"
          aria-label="프로필 사진 선택"
          className="sr-only"
          onChange={handleAvatarInputChange}
          ref={fileInputRef}
          type="file"
        />
      </section>

      <form className="mt-6 space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
        <FormField
          errorMessage={form.formState.errors.displayName?.message}
          label="이름"
          name="displayName"
        >
          <TextField.Root className="talkhugam-information-field">
            <TextField.Input {...form.register('displayName')} />
          </TextField.Root>
        </FormField>
        <FormField errorMessage={form.formState.errors.bio?.message} label="한 줄 소개" name="bio">
          <TextField.Root className="talkhugam-information-field">
            <TextField.Textarea autoresize={false} maxLength={80} {...form.register('bio')} />
          </TextField.Root>
        </FormField>
        {errorMessage ? (
          <p className="text-sm text-red-600" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <ActionButton
          className="talkhugam-primary-action w-full"
          disabled={isSaveDisabled}
          loading={form.formState.isSubmitting}
          size="large"
          type="submit"
          variant="brandSolid"
        >
          저장하기
        </ActionButton>
      </form>
    </main>
  )
}

/** 프로필 편집 상태 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
function ProfileEditState({ message }: { message: string }) {
  return (
    <main className="app-page bg-surface flex items-center justify-center px-4">
      <BrandLoadingSpinner label={message} />
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
