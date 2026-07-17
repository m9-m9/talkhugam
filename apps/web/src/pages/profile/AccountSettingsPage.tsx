import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  AccountDeletionError,
  getNotificationPreferences,
  getProviderLabels,
  requestAccountDeletion,
  updateNotificationPreferences,
  type AccountDeletionMode,
  type NotificationPreferences,
} from '../../entities/profile'
import { useAuthenticatedUser } from '../../features/auth'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { AppHeader } from '../../shared/ui/AppHeader'
import { trapDialogFocus } from '../../shared/ui/dialogFocus'
import { LoadingSpinner } from '../../shared/ui/LoadingSpinner'
import { RetryState } from '../../shared/ui/RetryState'

type AccountIdentity = {
  email: string
  providers: string[]
}
type NotificationPreferenceKey = keyof NotificationPreferences

const notificationPreferenceLabels: Record<NotificationPreferenceKey, string> = {
  mentionsEnabled: '멘션 알림',
  repliesEnabled: '답글 알림',
  roomEventsEnabled: '독서방 알림',
}

/** 계정 설정 페이지 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
export function AccountSettingsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthenticatedUser()
  const client = createSupabaseClient()
  const deletionTriggerRef = useRef<HTMLButtonElement>(null)
  const [isDeletionDialogOpen, setIsDeletionDialogOpen] = useState(false)
  const [isRetryingNotificationPreferences, setIsRetryingNotificationPreferences] = useState(false)
  const account = createAccountIdentity(user.email, user.appMetadata)
  const notificationPreferencesQuery = useQuery({
    queryFn: () => getNotificationPreferences(client, user.id),
    queryKey: ['notification-preferences', user.id],
  })
  const notificationPreferencesMutation = useMutation({
    mutationFn: (preferences: NotificationPreferences) =>
      updateNotificationPreferences(client, user.id, preferences),
    onSuccess: (preferences) => {
      queryClient.setQueryData(['notification-preferences', user.id], preferences)
    },
  })
  const accountDeletionMutation = useMutation({
    mutationFn: async (mode: AccountDeletionMode) => {
      await requestAccountDeletion(client, mode)
      await clearLocalSession(client)
    },
    onSuccess: () => void navigate('/', { replace: true }),
  })

  /** 알림 수신 설정 변경 요청이나 사용자 동작을 처리한다. */
  function handlePreferenceChange(key: NotificationPreferenceKey) {
    const preferences = notificationPreferencesQuery.data
    if (!preferences || notificationPreferencesMutation.isPending) return

    notificationPreferencesMutation.mutate({
      ...preferences,
      [key]: !preferences[key],
    })
  }

  /** 실패한 알림 설정 조회를 다시 요청하고 재시도 피드백을 유지한다. */
  function handleRetryNotificationPreferences() {
    setIsRetryingNotificationPreferences(true)
    void notificationPreferencesQuery
      .refetch()
      .finally(() => setIsRetryingNotificationPreferences(false))
  }

  /** 계정 삭제 확인창을 연다. */
  function handleOpenDeletionDialog() {
    accountDeletionMutation.reset()
    setIsDeletionDialogOpen(true)
  }

  /** 계정 삭제 확인창을 닫는다. */
  function handleCloseDeletionDialog() {
    if (accountDeletionMutation.isPending) return
    setIsDeletionDialogOpen(false)
    deletionTriggerRef.current?.focus()
  }

  /** 계정 삭제 방식을 서버에 요청한다. */
  function handleConfirmDeletion(mode: AccountDeletionMode) {
    accountDeletionMutation.mutate(mode)
  }

  return (
    <main className="app-page bg-surface px-4 pb-8">
      <AppHeader onBack={() => void navigate('/profile')} title="계정 설정" />
      <header className="mt-8">
        <p className="text-primary text-sm font-medium">계정</p>
        <h1 className="text-ink mt-2 text-2xl font-bold">계정 설정</h1>
        <p className="text-ink-subtle mt-2 text-sm">로그인과 알림 수신 방식을 관리해요.</p>
      </header>

      <AccountInformation account={account} />
      <NotificationPreferencesSection
        queryErrorMessage={
          notificationPreferencesQuery.isError || isRetryingNotificationPreferences
            ? '알림 설정을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'
            : null
        }
        saveErrorMessage={
          notificationPreferencesMutation.isError
            ? '알림 설정을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.'
            : null
        }
        isLoading={notificationPreferencesQuery.isPending && !isRetryingNotificationPreferences}
        isRetrying={isRetryingNotificationPreferences}
        isSaving={notificationPreferencesMutation.isPending}
        onChange={handlePreferenceChange}
        onRetry={handleRetryNotificationPreferences}
        preferences={notificationPreferencesQuery.data ?? null}
      />

      <section className="mt-12" aria-labelledby="danger-zone-heading">
        <h2 className="text-ink text-base font-bold" id="danger-zone-heading">
          계정 삭제
        </h2>
        <p className="text-ink-subtle mt-2 text-sm">삭제한 계정은 되돌릴 수 없어요.</p>
        <button
          className="border-danger text-danger mt-4 min-h-11 w-full cursor-pointer rounded-md border bg-white px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          onClick={handleOpenDeletionDialog}
          ref={deletionTriggerRef}
          type="button"
        >
          계정 삭제
        </button>
      </section>

      {isDeletionDialogOpen ? (
        <AccountDeletionDialog
          error={accountDeletionMutation.error}
          isDeleting={accountDeletionMutation.isPending}
          onClose={handleCloseDeletionDialog}
          onConfirm={handleConfirmDeletion}
        />
      ) : null}
    </main>
  )
}

/** 서버 계정 삭제 뒤 브라우저 세션을 정리하되 실패를 삭제 실패로 바꾸지 않는다. */
async function clearLocalSession(client: ReturnType<typeof createSupabaseClient>): Promise<void> {
  try {
    await client.auth.signOut()
  } catch {
    return
  }
}

/** 인증 사용자 데이터를 계정 화면용 정보로 변환한다. */
function createAccountIdentity(
  email: string | null | undefined,
  appMetadata: unknown,
): AccountIdentity {
  return {
    email: email ?? '이메일 정보를 찾을 수 없어요',
    providers: getProviderLabels(appMetadata),
  }
}

/** 로그인 수단과 이메일을 읽기 전용 정보로 렌더링한다. */
function AccountInformation({ account }: { account: AccountIdentity }) {
  return (
    <section className="mt-8" aria-label="계정 정보">
      <dl className="border-ink/10 overflow-hidden rounded-lg border bg-white">
        <AccountDetail label="이메일" value={account.email} />
        <AccountDetail
          label="로그인 수단"
          value={account.providers.length > 0 ? account.providers.join(', ') : '확인할 수 없어요'}
        />
      </dl>
    </section>
  )
}

/** 알림 수신 설정 목록을 렌더링한다. */
function NotificationPreferencesSection({
  queryErrorMessage,
  saveErrorMessage,
  isLoading,
  isRetrying,
  isSaving,
  onChange,
  onRetry,
  preferences,
}: {
  queryErrorMessage: string | null
  saveErrorMessage: string | null
  isLoading: boolean
  isRetrying: boolean
  isSaving: boolean
  onChange: (key: NotificationPreferenceKey) => void
  onRetry: () => void
  preferences: NotificationPreferences | null
}) {
  return (
    <section className="mt-12" aria-labelledby="notification-settings-heading">
      <h2 className="text-ink text-base font-bold" id="notification-settings-heading">
        알림 설정
      </h2>
      <p className="text-ink-subtle mt-2 text-sm">원하지 않는 알림은 언제든 끌 수 있어요.</p>
      {isLoading ? (
        <div className="mt-4">
          <LoadingSpinner label="알림 설정을 불러오고 있어요." size="xs" />
        </div>
      ) : preferences ? (
        <ul className="border-ink/10 mt-4 overflow-hidden rounded-lg border bg-white">
          {(Object.keys(notificationPreferenceLabels) as NotificationPreferenceKey[]).map((key) => (
            <li className="border-ink/10 border-b last:border-b-0" key={key}>
              <NotificationPreferenceToggle
                checked={preferences[key]}
                disabled={isSaving}
                label={notificationPreferenceLabels[key]}
                onChange={() => onChange(key)}
              />
            </li>
          ))}
        </ul>
      ) : null}
      {queryErrorMessage ? (
        <div className="mt-4">
          <RetryState isRetrying={isRetrying} message={queryErrorMessage} onRetry={onRetry} />
          {isRetrying ? (
            <div className="mt-4">
              <LoadingSpinner label="알림 설정을 다시 불러오고 있어요." size="xs" />
            </div>
          ) : null}
        </div>
      ) : null}
      {saveErrorMessage ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {saveErrorMessage}
        </p>
      ) : null}
    </section>
  )
}

/** 하나의 알림 수신 여부를 키보드로도 조작 가능한 토글로 렌더링한다. */
function NotificationPreferenceToggle({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean
  disabled: boolean
  label: string
  onChange: () => void
}) {
  return (
    <label className="flex min-h-14 cursor-pointer items-center justify-between gap-4 px-4 py-2 has-[:disabled]:cursor-not-allowed">
      <span className="text-ink text-sm font-medium">{label}</span>
      <span className="relative flex size-11 items-center justify-center">
        <input
          aria-label={label}
          checked={checked}
          className="peer sr-only"
          disabled={disabled}
          onChange={onChange}
          type="checkbox"
        />
        <span
          aria-hidden="true"
          className="bg-ink/20 after:bg-surface peer-focus-visible:ring-primary peer-checked:bg-primary relative h-6 w-10 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-disabled:opacity-40 after:absolute after:top-1 after:left-1 after:size-4 after:rounded-full after:transition-transform peer-checked:after:translate-x-4"
        />
      </span>
    </label>
  )
}

/** 계정 삭제 방식 선택과 최종 확인을 모달로 렌더링한다. */
function AccountDeletionDialog({
  error,
  isDeleting,
  onClose,
  onConfirm,
}: {
  error: Error | null
  isDeleting: boolean
  onClose: () => void
  onConfirm: (mode: AccountDeletionMode) => void
}) {
  const [hasConfirmed, setHasConfirmed] = useState(false)
  const [mode, setMode] = useState<AccountDeletionMode | null>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const firstModeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    firstModeRef.current?.focus()

    /** Escape 키 입력으로 삭제 확인창을 닫는다. */
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key === 'Tab') trapDialogFocus(event, dialogRef.current)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  /** 계정 삭제 최종 확인 요청이나 사용자 동작을 처리한다. */
  function handleConfirm() {
    if (!mode || !hasConfirmed || isDeleting) return
    onConfirm(mode)
  }

  /** 배경을 눌렀을 때만 계정 삭제 확인창을 닫는다. */
  function handleBackdropMouseDown(event: React.MouseEvent<HTMLDivElement>) {
    if (event.currentTarget !== event.target) return
    event.preventDefault()
    onClose()
  }

  return (
    <div
      aria-hidden="false"
      className="bg-ink/40 fixed inset-0 z-50 flex items-end justify-center px-4 pb-4 sm:items-center"
      onMouseDown={handleBackdropMouseDown}
    >
      <section
        aria-labelledby="account-deletion-dialog-heading"
        aria-modal="true"
        className="bg-surface w-full max-w-md rounded-lg p-6 shadow-xl"
        ref={dialogRef}
        role="dialog"
      >
        <p className="text-danger text-sm font-semibold">되돌릴 수 없는 작업</p>
        <h2 className="text-ink mt-2 text-xl font-bold" id="account-deletion-dialog-heading">
          계정 삭제
        </h2>
        <p className="text-ink-subtle mt-3 text-sm">
          방장이 있는 독서방은 먼저 다른 멤버에게 방장을 넘겨야 해요.
        </p>
        <fieldset className="mt-6 space-y-3">
          <legend className="text-ink text-sm font-semibold">기록을 어떻게 처리할까요?</legend>
          <DeletionModeOption
            checked={mode === 'anonymize'}
            description="작성자 이름만 ‘탈퇴한 사용자’로 바꾸고 대화는 남겨요."
            disabled={isDeleting}
            label="대화 기록은 남기고 탈퇴"
            onChange={() => setMode('anonymize')}
            inputRef={firstModeRef}
            value="anonymize"
          />
          <DeletionModeOption
            checked={mode === 'delete_content'}
            description="내가 남긴 메시지와 영상도 함께 삭제해요."
            disabled={isDeleting}
            label="내 대화도 함께 삭제"
            onChange={() => setMode('delete_content')}
            value="delete_content"
          />
        </fieldset>
        <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 text-sm has-[:disabled]:cursor-not-allowed">
          <input
            aria-label="선택한 방식으로 계정을 삭제하는 데 동의합니다."
            checked={hasConfirmed}
            className="accent-danger size-5"
            disabled={isDeleting}
            onChange={(event) => setHasConfirmed(event.target.checked)}
            type="checkbox"
          />
          <span className="text-ink">선택한 방식으로 계정을 삭제하는 데 동의합니다.</span>
        </label>
        {error ? (
          <p className="mt-4 text-sm text-red-600" role="alert">
            {getDeletionErrorMessage(error)}
          </p>
        ) : null}
        <div className="mt-6 flex gap-3">
          <button
            className="border-ink/10 text-ink min-h-11 flex-1 cursor-pointer rounded-md border bg-white px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isDeleting}
            onClick={onClose}
            type="button"
          >
            취소
          </button>
          <button
            className="bg-danger min-h-11 flex-1 cursor-pointer rounded-md px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!mode || !hasConfirmed || isDeleting}
            onClick={handleConfirm}
            type="button"
          >
            {isDeleting ? '삭제하고 있어요…' : '계정 삭제하기'}
          </button>
        </div>
      </section>
    </div>
  )
}

/** 계정 삭제 방식 하나를 선택 가능한 카드로 렌더링한다. */
function DeletionModeOption({
  checked,
  description,
  disabled,
  label,
  onChange,
  inputRef,
  value,
}: {
  checked: boolean
  description: string
  disabled: boolean
  label: string
  onChange: () => void
  inputRef?: React.RefObject<HTMLInputElement | null>
  value: AccountDeletionMode
}) {
  return (
    <label className="border-ink/10 has-[:checked]:border-primary flex cursor-pointer gap-3 rounded-md border p-3 has-[:disabled]:cursor-not-allowed">
      <input
        aria-label={label}
        checked={checked}
        className="accent-primary mt-0.5 size-4"
        disabled={disabled}
        name="account-deletion-mode"
        onChange={onChange}
        ref={inputRef}
        type="radio"
        value={value}
      />
      <span>
        <span className="text-ink block text-sm font-semibold">{label}</span>
        <span className="text-ink-subtle mt-1 block text-xs">{description}</span>
      </span>
    </label>
  )
}

/** 계정 삭제 오류를 사용자 행동이 가능한 문구로 변환한다. */
function getDeletionErrorMessage(error: Error): string {
  if (error instanceof AccountDeletionError && error.code === 'OWNER_TRANSFER_REQUIRED') {
    return '방장이 있는 독서방은 다른 멤버에게 방장을 넘긴 뒤 삭제할 수 있어요.'
  }

  return '계정 삭제를 완료하지 못했어요. 잠시 후 다시 시도해 주세요.'
}

/** 계정 상세 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
function AccountDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-ink/10 flex flex-col gap-2 border-b px-4 py-4 last:border-b-0">
      <dt className="text-ink-subtle text-sm">{label}</dt>
      <dd className="text-ink text-sm break-all">{value}</dd>
    </div>
  )
}
