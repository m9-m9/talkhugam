import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'

import { ActionButton, TextField } from '@seed-design/react'

import {
  createRoomFormSchema,
  createRoomWithInvite,
  readingRoomKeys,
  type CreatedRoomInvite,
  type CreateRoomForm,
} from '../../entities/reading-room'
import { useAuthenticatedUser } from '../../features/auth'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { trackAnalyticsEvent } from '../../shared/analytics'
import { AppHeader } from '../../shared/ui/AppHeader'
import { FormField } from '../../shared/ui/FormField'
import { BrandLoadingSpinner } from '../../shared/ui/LoadingSpinner'

/** 새 책방을 만들고 초대 코드를 생성하는 화면을 렌더링한다. */
export function CreateRoomPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthenticatedUser()
  const [createdRoom, setCreatedRoom] = useState<CreatedRoomInvite | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const form = useForm<CreateRoomForm>({
    defaultValues: { description: '', name: '' },
    resolver: zodResolver(createRoomFormSchema),
  })

  /** 제출 요청이나 사용자 동작을 처리한다. */
  async function handleSubmit(values: CreateRoomForm) {
    setErrorMessage(null)
    const client = createSupabaseClient()

    try {
      const invite = await createRoomWithInvite(client, user.id, values)
      await queryClient.invalidateQueries({ queryKey: readingRoomKeys.all })
      trackAnalyticsEvent('reading_room_created')
      setCreatedRoom(invite)
    } catch {
      setErrorMessage('책방을 만들지 못했어요. 잠시 후 다시 시도해 주세요.')
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
    <main className="app-page bg-surface px-4 pb-8">
      <AppHeader onBack={() => void navigate(-1)} title="책방 만들기" />
      <header className="mt-8">
        <h1 className="text-ink text-xl font-bold">책방 만들기</h1>
        <p className="text-ink-subtle mt-1 text-sm">책방 이름을 정하고 친구를 초대해 보세요.</p>
      </header>

      <form className="mt-12 space-y-6" onSubmit={form.handleSubmit(handleSubmit)}>
        <FormField errorMessage={form.formState.errors.name?.message} label="책방 이름" name="name">
          <TextField.Root className="talkhugam-information-field">
            <TextField.Input placeholder="예: 금요일 아침 책방" {...form.register('name')} />
          </TextField.Root>
        </FormField>

        <FormField
          errorMessage={form.formState.errors.description?.message}
          label="한 줄 소개"
          name="description"
          optional
        >
          <TextField.Root className="talkhugam-information-field">
            <TextField.Textarea
              autoresize={false}
              placeholder="예: 이번 달 함께 읽는 책들"
              {...form.register('description')}
            />
          </TextField.Root>
        </FormField>

        <p className="text-ink-subtle text-xs">초대받은 사람만 참여할 수 있는 비공개 방이에요.</p>
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
              <BrandLoadingSpinner label="책방을 만들고 있어요." showLabel={false} size="xs" />
              책방을 만들고 있어요…
            </span>
          ) : (
            '책방 만들기'
          )}
        </ActionButton>
      </form>
    </main>
  )
}

/** 책방 생성 직후 초대 코드를 공유할 수 있는 완료 화면을 렌더링한다. */
function RoomCreatedPage({ invite, onClose }: { invite: CreatedRoomInvite; onClose: () => void }) {
  const [isCopied, setIsCopied] = useState(false)

  /** 복사 초대 요청이나 사용자 동작을 처리한다. */
  async function handleCopyInvite() {
    try {
      await navigator.clipboard.writeText(invite.code)
      setIsCopied(true)
    } catch {
      setIsCopied(false)
    }
  }

  return (
    <main className="app-page bg-surface flex flex-col px-4 pb-8">
      <AppHeader
        action={
          <ActionButton
            className="text-primary"
            onClick={onClose}
            size="medium"
            type="button"
            variant="ghost"
          >
            나중에
          </ActionButton>
        }
        title="책방 만들기 완료"
      />
      <header className="mt-8">
        <h1 className="text-ink text-xl font-bold">책방 만들기 완료</h1>
        <p className="text-ink-subtle mt-1 text-sm">새 책방을 만들었어요.</p>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p className="text-ink text-2xl font-bold">책방이 만들어졌어요!</p>
        <p className="text-ink-subtle mt-3 text-sm">
          초대 코드를 보내고 함께 읽을 친구를 불러보세요.
        </p>
        <div className="talkhugam-information-surface border-border mt-8 w-full rounded-lg border p-6">
          <p className="text-ink-subtle text-xs">초대 코드</p>
          <p className="text-ink mt-2 text-3xl font-bold tracking-widest">{invite.code}</p>
        </div>
        <ActionButton
          className="talkhugam-primary-action mt-6 w-full"
          onClick={() => void handleCopyInvite()}
          size="large"
          type="button"
          variant="brandSolid"
        >
          {isCopied ? '초대 코드 복사 완료' : '초대 코드 복사하기'}
        </ActionButton>
      </div>
    </main>
  )
}
