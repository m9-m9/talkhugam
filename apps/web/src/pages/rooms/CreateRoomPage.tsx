import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'

import {
  createRoomFormSchema,
  createRoomWithInvite,
  readingRoomKeys,
  type CreatedRoomInvite,
  type CreateRoomForm,
} from '../../entities/reading-room'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { LoadingSpinner } from '../../shared/ui/LoadingSpinner'

export function CreateRoomPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [createdRoom, setCreatedRoom] = useState<CreatedRoomInvite | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const form = useForm<CreateRoomForm>({
    defaultValues: { description: '', name: '' },
    resolver: zodResolver(createRoomFormSchema),
  })

  async function handleSubmit(values: CreateRoomForm) {
    setErrorMessage(null)
    const client = createSupabaseClient()
    const session = await client.auth.getUser()

    if (session.error || !session.data.user) {
      void navigate('/', { replace: true })
      return
    }

    try {
      const invite = await createRoomWithInvite(client, session.data.user.id, values)
      await queryClient.invalidateQueries({ queryKey: readingRoomKeys.all })
      setCreatedRoom(invite)
    } catch {
      setErrorMessage('독서방을 만들지 못했어요. 잠시 후 다시 시도해 주세요.')
    }
  }

  if (createdRoom) {
    return (
      <RoomCreatedPage
        invite={createdRoom}
        onClose={() => void navigate('/rooms', { replace: true })}
      />
    )
  }

  return (
    <main className="app-page bg-surface px-6 py-8">
      <button
        className="text-ink-subtle -ml-3 min-h-11 px-3 text-sm"
        onClick={() => void navigate(-1)}
        type="button"
      >
        ← 뒤로
      </button>
      <header className="mt-3">
        <h1 className="text-ink text-xl font-bold">독서방 만들기</h1>
        <p className="text-ink-subtle mt-1 text-sm">이름을 정하고 친구를 초대해 보세요.</p>
      </header>

      <form className="mt-12 space-y-6" onSubmit={form.handleSubmit(handleSubmit)}>
        <FormField errorMessage={form.formState.errors.name?.message} label="독서방 이름">
          <input
            aria-invalid={Boolean(form.formState.errors.name)}
            className="border-ink/10 focus:border-primary min-h-12 w-full rounded-md border bg-white px-4 text-sm outline-none"
            placeholder="예: 금요일 아침 독서방"
            {...form.register('name')}
          />
        </FormField>

        <FormField
          errorMessage={form.formState.errors.description?.message}
          label="한 줄 소개 (선택)"
        >
          <textarea
            className="border-ink/10 focus:border-primary min-h-24 w-full resize-none rounded-md border bg-white px-4 py-3 text-sm outline-none"
            placeholder="예: 이번 달 함께 읽는 책들"
            {...form.register('description')}
          />
        </FormField>

        <p className="text-ink-subtle text-xs">초대받은 사람만 참여할 수 있는 비공개 방이에요.</p>
        {errorMessage ? (
          <p className="text-sm text-red-600" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <button
          className="bg-primary min-h-12 w-full rounded-md px-4 text-sm font-semibold text-white disabled:opacity-45"
          disabled={form.formState.isSubmitting}
          type="submit"
        >
          {form.formState.isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <LoadingSpinner label="독서방을 만들고 있어요." showLabel={false} size="xs" />
              독서방을 만들고 있어요…
            </span>
          ) : (
            '독서방 만들기'
          )}
        </button>
      </form>
    </main>
  )
}

function RoomCreatedPage({ invite, onClose }: { invite: CreatedRoomInvite; onClose: () => void }) {
  const [isCopied, setIsCopied] = useState(false)

  async function handleCopyInvite() {
    try {
      await navigator.clipboard.writeText(invite.code)
      setIsCopied(true)
    } catch {
      setIsCopied(false)
    }
  }

  return (
    <main className="app-page bg-surface flex flex-col px-6 py-8">
      <header>
        <h1 className="text-ink text-xl font-bold">독서방 만들기 완료</h1>
        <p className="text-ink-subtle mt-1 text-sm">새 독서방을 만들었어요.</p>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p className="text-ink text-2xl font-bold">독서방이 만들어졌어요!</p>
        <p className="text-ink-subtle mt-3 text-sm">
          초대 코드를 보내고 함께 읽을 친구를 불러보세요.
        </p>
        <div className="bg-surface-muted mt-8 w-full rounded-lg p-6">
          <p className="text-ink-subtle text-xs">초대 코드</p>
          <p className="text-ink mt-2 text-3xl font-bold tracking-widest">{invite.code}</p>
        </div>
        <button
          className="bg-primary mt-6 min-h-12 w-full rounded-md px-4 text-sm font-semibold text-white"
          onClick={() => void handleCopyInvite()}
          type="button"
        >
          {isCopied ? '초대 코드 복사 완료' : '초대 코드 복사하기'}
        </button>
      </div>
      <button className="text-ink-subtle min-h-11 text-sm" onClick={onClose} type="button">
        나중에 하기
      </button>
    </main>
  )
}

function FormField({
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
