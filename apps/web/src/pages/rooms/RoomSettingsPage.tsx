import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { ActionButton, TextField } from '@seed-design/react'

import {
  getRoomManagement,
  roomManagementKeys,
  updateManagedRoom,
} from '../../entities/room-management'
import { useAuthenticatedUser } from '../../features/auth'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { AppHeader } from '../../shared/ui/AppHeader'
import { FormField } from '../../shared/ui/FormField'
import { BookLoadingIndicator } from '../../shared/ui/LoadingSpinner'

const roomSettingsSchema = z.object({
  description: z.string().trim().max(120, '소개는 120자 이내로 작성해 주세요.'),
  name: z
    .string()
    .trim()
    .min(1, '책방 이름을 입력해 주세요.')
    .max(40, '책방 이름은 40자 이내로 작성해 주세요.'),
})
type RoomSettingsForm = z.infer<typeof roomSettingsSchema>

/** 방장이 책방 이름과 소개를 편집하는 설정 화면을 렌더링한다. */
export function RoomSettingsPage() {
  const client = createSupabaseClient()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthenticatedUser()
  const { roomId } = useParams()
  const roomQuery = useQuery({
    enabled: Boolean(roomId),
    queryFn: () => getRoomManagement(client, roomId ?? '', user.id),
    queryKey: roomManagementKeys.detail(roomId ?? ''),
  })
  const form = useForm<RoomSettingsForm>({
    defaultValues: { description: '', name: '' },
    resolver: zodResolver(roomSettingsSchema),
    values: { description: roomQuery.data?.description ?? '', name: roomQuery.data?.name ?? '' },
  })
  const saveMutation = useMutation({
    mutationFn: (values: RoomSettingsForm) => updateManagedRoom(client, roomId ?? '', values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: roomManagementKeys.detail(roomId ?? '') })
      void navigate(`/rooms/${roomId}/manage`, { replace: true })
    },
  })

  /** 수정한 방 정보를 저장한다. */
  function handleSubmit(values: RoomSettingsForm) {
    saveMutation.mutate(values)
  }

  if (!roomId || roomQuery.isPending) return <RoomSettingsLoadingPage />
  if (roomQuery.isError || roomQuery.data === null || !roomQuery.data.isCurrentUserOwner)
    return <RoomSettingsUnavailablePage onBack={() => void navigate(`/rooms/${roomId}/manage`)} />

  return (
    <main className="app-page bg-surface px-4 pb-8">
      <AppHeader onBack={() => void navigate(`/rooms/${roomId}/manage`)} title="방 설정" />
      <header className="mt-8">
        <h1 className="text-ink text-xl font-bold">책방을 소개해 주세요</h1>
        <p className="text-ink-subtle mt-2 text-sm">이 방에 참여한 사람들이 함께 볼 정보예요.</p>
      </header>
      <form className="mt-12 space-y-6" onSubmit={form.handleSubmit(handleSubmit)}>
        <FormField errorMessage={form.formState.errors.name?.message} label="책방 이름" name="name">
          <TextField.Root className="talkhugam-information-field">
            <TextField.Input {...form.register('name')} />
          </TextField.Root>
        </FormField>
        <FormField
          errorMessage={form.formState.errors.description?.message}
          label="한 줄 소개"
          name="description"
        >
          <TextField.Root className="talkhugam-information-field">
            <TextField.Textarea autoresize={false} {...form.register('description')} />
          </TextField.Root>
        </FormField>
        {saveMutation.isError ? (
          <p className="text-sm text-red-600" role="alert">
            방 정보를 저장하지 못했어요. 다시 시도해 주세요.
          </p>
        ) : null}
        <ActionButton
          className="talkhugam-primary-action w-full"
          disabled={saveMutation.isPending}
          loading={saveMutation.isPending}
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

/** 방 설정 정보를 불러오는 동안 책 로더를 렌더링한다. */
function RoomSettingsLoadingPage() {
  return (
    <main className="app-page bg-surface flex min-h-screen items-center justify-center">
      <BookLoadingIndicator label="방 설정을 불러오고 있어요." />
    </main>
  )
}

/** 방 설정 권한이 없을 때 이전 화면으로 복귀할 선택지를 제공한다. */
function RoomSettingsUnavailablePage({ onBack }: { onBack: () => void }) {
  return (
    <main className="app-page bg-surface flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="text-ink text-lg font-bold">방 설정 권한이 없어요</p>
      <ActionButton
        className="talkhugam-primary-action mt-6"
        onClick={onBack}
        size="large"
        type="button"
        variant="brandSolid"
      >
        방 정보로
      </ActionButton>
    </main>
  )
}
