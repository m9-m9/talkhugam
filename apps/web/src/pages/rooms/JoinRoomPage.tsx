import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { ActionButton, TextField } from '@seed-design/react'

import {
  joinRoomByCode,
  joinRoomFormSchema,
  parseInviteToken,
  readingRoomKeys,
  type JoinRoomForm,
} from '../../entities/reading-room'
import { useAuthenticatedUser } from '../../features/auth'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { trackAnalyticsEvent } from '../../shared/analytics'
import { AppHeader } from '../../shared/ui/AppHeader'
import { FormField } from '../../shared/ui/FormField'
import { BrandLoadingSpinner } from '../../shared/ui/LoadingSpinner'

/** 초대 코드로 책방에 참여하는 화면을 렌더링한다. */
export function JoinRoomPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const user = useAuthenticatedUser()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const inviteToken = parseInviteToken(searchParams.get('invite'))
  const form = useForm<JoinRoomForm>({
    defaultValues: { code: inviteToken ?? '' },
    resolver: zodResolver(joinRoomFormSchema),
  })

  /** 제출 요청이나 사용자 동작을 처리한다. */
  async function handleSubmit(values: JoinRoomForm) {
    setErrorMessage(null)
    const client = createSupabaseClient()

    try {
      await joinRoomByCode(client, user.id, values)
      await queryClient.invalidateQueries({ queryKey: readingRoomKeys.all })
      trackAnalyticsEvent('reading_room_joined')
      void navigate('/rooms', { replace: true })
    } catch {
      setErrorMessage('앗, 이 코드로는 못 들어가요. 만료됐거나 잘못 입력된 코드 같아요.')
    }
  }

  return (
    <main className="app-page bg-surface px-4 pb-8">
      <AppHeader onBack={() => void navigate(-1)} title="초대 코드" />
      <header className="mt-12 text-center">
        <p aria-hidden="true" className="text-primary text-2xl">
          ✦
        </p>
        <h1 className="text-ink mt-4 text-2xl font-bold">책방 초대장을 받았어요</h1>
        <p className="talkhugam-balanced-copy text-ink-subtle mt-3 text-sm whitespace-pre-line">
          {inviteToken
            ? '친구가 보낸 초대 링크예요.\n참여하면 함께 읽는 책방 목록에 바로 추가돼요.'
            : '친구가 보내준 6자리 코드를 넣으면,\n어떤 책방인지 미리 확인할 수 있어요.'}
        </p>
      </header>

      <form className="mt-12" onSubmit={form.handleSubmit(handleSubmit)}>
        {inviteToken ? null : (
          <>
            <div className="talkhugam-invite-code-field">
              <FormField
                errorMessage={form.formState.errors.code?.message}
                label="6자리 초대 코드"
                name="code"
              >
                <TextField.Root
                  className="talkhugam-information-field"
                  invalid={Boolean(errorMessage)}
                >
                  <TextField.Input
                    autoCapitalize="characters"
                    autoComplete="one-time-code"
                    className="text-center text-xl font-bold tracking-widest uppercase"
                    maxLength={6}
                    placeholder="ABC123"
                    {...form.register('code')}
                  />
                </TextField.Root>
              </FormField>
            </div>
            <p className="talkhugam-invite-code-help text-ink-subtle mt-4 text-center text-xs">
              대문자·소문자는 안 가려도 돼요
            </p>
          </>
        )}
        {errorMessage ? (
          <p className="mt-4 text-sm text-red-600" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <ActionButton
          className="talkhugam-primary-action mt-10 w-full"
          disabled={form.formState.isSubmitting}
          loading={form.formState.isSubmitting}
          size="large"
          type="submit"
          variant="brandSolid"
        >
          {form.formState.isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <BrandLoadingSpinner label="책방에 들어가고 있어요." showLabel={false} size="xs" />
              입장하고 있어요…
            </span>
          ) : inviteToken ? (
            '초대받은 책방에 참여하기'
          ) : (
            '함께 읽기 시작하기'
          )}
        </ActionButton>
      </form>

      <p className="text-ink-subtle mt-12 text-center text-xs whitespace-pre-line">
        {'코드를 못 받았나요?\n초대한 친구에게 살짝 물어보세요'}
      </p>
    </main>
  )
}
