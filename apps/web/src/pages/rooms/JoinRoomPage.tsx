import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'

import {
  joinRoomByCode,
  joinRoomFormSchema,
  readingRoomKeys,
  type JoinRoomForm,
} from '../../entities/reading-room'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { AppHeader } from '../../shared/ui/AppHeader'
import { LoadingSpinner } from '../../shared/ui/LoadingSpinner'

export function JoinRoomPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const form = useForm<JoinRoomForm>({
    defaultValues: { code: '' },
    resolver: zodResolver(joinRoomFormSchema),
  })

  async function handleSubmit(values: JoinRoomForm) {
    setErrorMessage(null)
    const client = createSupabaseClient()
    const session = await client.auth.getUser()

    if (session.error || !session.data.user) {
      void navigate('/', { replace: true })
      return
    }

    try {
      await joinRoomByCode(client, session.data.user.id, values)
      await queryClient.invalidateQueries({ queryKey: readingRoomKeys.all })
      void navigate('/rooms', { replace: true })
    } catch {
      setErrorMessage('앗, 이 코드로는 못 들어가요. 만료됐거나 잘못 입력된 코드 같아요.')
    }
  }

  return (
    <main className="app-page bg-surface px-6 pb-8">
      <AppHeader onBack={() => void navigate(-1)} title="초대 코드" />
      <header className="mt-12 text-center">
        <p aria-hidden="true" className="text-primary text-2xl">
          ✦
        </p>
        <h1 className="text-ink mt-4 text-2xl font-bold">독서방 초대장을 받았어요</h1>
        <p className="text-ink-subtle mt-3 text-sm whitespace-pre-line">
          {'친구가 보내준 6자리 코드를 넣으면,\n무슨 책을 읽는 방인지 미리 볼 수 있어요'}
        </p>
      </header>

      <form className="mt-12" onSubmit={form.handleSubmit(handleSubmit)}>
        <label className="block">
          <span className="sr-only">6자리 초대 코드</span>
          <input
            aria-invalid={Boolean(errorMessage || form.formState.errors.code)}
            autoCapitalize="characters"
            autoComplete="one-time-code"
            className="border-ink/10 focus:border-primary min-h-12 w-full rounded-md border bg-white px-4 text-center text-xl font-bold tracking-widest uppercase outline-none"
            maxLength={6}
            placeholder="ABC123"
            {...form.register('code')}
          />
        </label>
        <p className="text-ink-subtle mt-3 text-center text-xs">대문자·소문자는 안 가려도 돼요</p>
        {form.formState.errors.code?.message ? (
          <p className="mt-4 text-sm text-red-600" role="alert">
            {form.formState.errors.code.message}
          </p>
        ) : null}
        {errorMessage ? (
          <p className="mt-4 text-sm text-red-600" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <button
          className="bg-primary mt-8 min-h-12 w-full rounded-md px-4 text-sm font-semibold text-white disabled:opacity-45"
          disabled={form.formState.isSubmitting}
          type="submit"
        >
          {form.formState.isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <LoadingSpinner label="독서방에 입장하고 있어요." showLabel={false} size="xs" />
              입장하고 있어요…
            </span>
          ) : (
            '함께 읽기 시작하기'
          )}
        </button>
      </form>

      <p className="text-ink-subtle mt-12 text-center text-xs whitespace-pre-line">
        {'코드를 못 받았나요?\n초대한 친구에게 살짝 물어보세요'}
      </p>
    </main>
  )
}
