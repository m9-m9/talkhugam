import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { forwardRef, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ActionButton, Checkbox, Dialog, Switch, ToggleButton } from '@seed-design/react'

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
import { BrandLoadingSpinner } from '../../shared/ui/LoadingSpinner'
import { RetryState } from '../../shared/ui/RetryState'

type AccountIdentity = {
  email: string
  hasNaverProvider: boolean
  providers: string[]
}
type NotificationPreferenceKey = keyof NotificationPreferences

const notificationPreferenceLabels: Record<NotificationPreferenceKey, string> = {
  mentionsEnabled: '멘션 알림',
  repliesEnabled: '답글 알림',
  roomEventsEnabled: '책방 알림',
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
    onSuccess: () => void navigate('/?account=deleted', { replace: true }),
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
    window.setTimeout(() => deletionTriggerRef.current?.focus(), 200)
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

      <AccountInformation
        account={account}
        onShowNaverInfo={() => void navigate('/profile/settings/naver-info')}
      />
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

      <section className="mt-12" aria-labelledby="service-information-heading">
        <h2 className="text-ink text-base font-bold" id="service-information-heading">
          서비스 정보
        </h2>
        <p className="text-ink-subtle mt-2 text-sm">
          이용 규칙, 개인정보 처리, 문의 방법을 확인해요.
        </p>
        <Link
          className="border-border mt-4 flex min-h-12 items-center justify-between rounded-md border bg-white px-4 text-sm font-semibold"
          to="/contact"
        >
          서비스 정보
          <span aria-hidden="true" className="text-ink-subtle text-lg">
            ›
          </span>
        </Link>
      </section>

      <section className="mt-12" aria-labelledby="danger-zone-heading">
        <h2 className="text-ink text-base font-bold" id="danger-zone-heading">
          계정 삭제
        </h2>
        <p className="text-ink-subtle mt-2 text-sm">삭제한 계정은 되돌릴 수 없어요.</p>
        <ActionButton
          className="border-danger text-danger mt-4 w-full"
          onClick={handleOpenDeletionDialog}
          ref={deletionTriggerRef}
          size="large"
          type="button"
          variant="neutralOutline"
        >
          계정 삭제
        </ActionButton>
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
  const providers = getProviderLabels(appMetadata)

  return {
    email: email ?? '이메일 정보를 찾을 수 없어요',
    hasNaverProvider: providers.includes('네이버'),
    providers,
  }
}

/** 로그인 수단과 이메일을 읽기 전용 정보로 렌더링한다. */
function AccountInformation({
  account,
  onShowNaverInfo,
}: {
  account: AccountIdentity
  onShowNaverInfo: () => void
}) {
  return (
    <section className="mt-8" aria-label="계정 정보">
      <dl className="talkhugam-information-surface border-ink/10 overflow-hidden rounded-lg border bg-white">
        <AccountDetail label="이메일" value={account.email} />
        <AccountDetail
          label="로그인 수단"
          value={account.providers.length > 0 ? account.providers.join(', ') : '확인할 수 없어요'}
        />
      </dl>
      {account.hasNaverProvider ? (
        <ActionButton
          className="border-ink/10 mt-4 h-auto min-h-12 w-full justify-between rounded-lg border bg-white px-4 text-left !whitespace-normal"
          onClick={onShowNaverInfo}
          size="large"
          type="button"
          variant="neutralWeak"
        >
          <span>
            <span className="text-ink block text-sm font-semibold">Naver 제공 정보</span>
            <span className="text-ink-subtle mt-1 block text-xs">
              로그인에 제공된 정보만 확인해요.
            </span>
          </span>
          <span aria-hidden="true" className="text-ink-subtle text-lg">
            ›
          </span>
        </ActionButton>
      ) : null}
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
          <BrandLoadingSpinner label="알림 설정을 불러오고 있어요." size="xs" />
        </div>
      ) : preferences ? (
        <ul className="talkhugam-information-surface border-ink/10 mt-4 overflow-hidden rounded-lg border bg-white">
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
              <BrandLoadingSpinner label="알림 설정을 다시 불러오고 있어요." size="xs" />
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
    <Switch.Root
      checked={checked}
      className="flex min-h-12 items-center justify-between gap-4 px-4 py-2"
      disabled={disabled}
      onCheckedChange={onChange}
    >
      <Switch.Label className="text-ink text-sm font-medium">{label}</Switch.Label>
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
      <Switch.HiddenInput aria-label={label} />
    </Switch.Root>
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
  const firstModeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    firstModeRef.current?.focus()
  }, [])

  /** 계정 삭제 최종 확인 요청이나 사용자 동작을 처리한다. */
  function handleConfirm() {
    if (!mode || !hasConfirmed || isDeleting) return
    onConfirm(mode)
  }

  /** SEED 대화상자가 닫힘을 요청했을 때 삭제 요청 중이 아닌 경우에만 부모 상태를 갱신한다. */
  function handleOpenChange(open: boolean) {
    if (open || isDeleting) return
    onClose()
  }

  return (
    <Dialog.Root onOpenChange={handleOpenChange} open>
      <Dialog.Positioner>
        <Dialog.Backdrop onClick={() => handleOpenChange(false)} />
        <Dialog.Content className="talkhugam-account-deletion-dialog">
          <Dialog.Header>
            <p className="text-danger text-sm font-semibold">되돌릴 수 없는 작업</p>
            <Dialog.Title>계정 삭제</Dialog.Title>
            <Dialog.Description>
              방장인 책방은 먼저 다른 멤버에게 방장을 넘겨야 해요.
            </Dialog.Description>
          </Dialog.Header>
          <fieldset className="mt-6 space-y-3 px-5">
            <legend className="text-ink text-sm font-semibold">기록을 어떻게 처리할까요?</legend>
            <DeletionModeButton
              description="작성자 이름만 ‘탈퇴한 사용자’로 바꾸고 대화는 남겨요."
              disabled={isDeleting}
              isSelected={mode === 'anonymize'}
              label="대화 기록은 남기고 탈퇴"
              onSelect={() => setMode('anonymize')}
              ref={firstModeRef}
            />
            <DeletionModeButton
              description="내가 남긴 메시지와 영상도 함께 삭제해요."
              disabled={isDeleting}
              isSelected={mode === 'delete_content'}
              label="내 대화도 함께 삭제"
              onSelect={() => setMode('delete_content')}
            />
          </fieldset>
          <Checkbox.Root
            checked={hasConfirmed}
            className="mt-4 flex min-h-11 items-center gap-3 px-5"
            disabled={isDeleting}
            onCheckedChange={setHasConfirmed}
            size="large"
          >
            <Checkbox.HiddenInput aria-label="선택한 방식으로 계정을 삭제하는 데 동의합니다." />
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
            <Checkbox.Label className="text-ink text-sm">
              선택한 방식으로 계정을 삭제하는 데 동의합니다.
            </Checkbox.Label>
          </Checkbox.Root>
          {error ? (
            <p className="mt-4 text-sm text-red-600" role="alert">
              {getDeletionErrorMessage(error)}
            </p>
          ) : null}
          <Dialog.Footer className="talkhugam-dialog-actions">
            <ActionButton
              disabled={isDeleting}
              onClick={onClose}
              size="large"
              type="button"
              variant="neutralOutline"
            >
              취소
            </ActionButton>
            <ActionButton
              disabled={!mode || !hasConfirmed || isDeleting}
              loading={isDeleting}
              onClick={handleConfirm}
              size="large"
              type="button"
              variant="criticalSolid"
            >
              계정 삭제하기
            </ActionButton>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  )
}

/** 계정 삭제 방식 하나를 SEED 토글 버튼으로 선택 가능하게 렌더링한다. */
const DeletionModeButton = forwardRef<
  HTMLButtonElement,
  {
    description: string
    disabled: boolean
    isSelected: boolean
    label: string
    onSelect: () => void
  }
>(function DeletionModeButton({ description, disabled, isSelected, label, onSelect }, ref) {
  return (
    <ToggleButton
      aria-label={label}
      className="talkhugam-foundation-toggle !h-auto min-h-16 w-full !justify-start overflow-hidden rounded-md px-3 py-3 text-left whitespace-normal"
      disabled={disabled}
      onClick={onSelect}
      pressed={isSelected}
      ref={ref}
      variant="neutralWeak"
    >
      <span className="min-w-0 break-words whitespace-normal">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="mt-1 block text-xs">{description}</span>
      </span>
    </ToggleButton>
  )
})

/** 계정 삭제 오류를 사용자 행동이 가능한 문구로 변환한다. */
function getDeletionErrorMessage(error: Error): string {
  if (error instanceof AccountDeletionError && error.code === 'OWNER_TRANSFER_REQUIRED') {
    return '방장인 책방은 다른 멤버에게 방장을 넘긴 뒤 삭제할 수 있어요.'
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
