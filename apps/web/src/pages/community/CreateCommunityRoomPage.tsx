import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { ActionButton, TextField } from '@seed-design/react'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'

import {
  communityKeys,
  createCommunityRoom,
  createCommunityRoomFormSchema,
  type CreateCommunityRoomForm,
} from '../../entities/community'
import { getProfile } from '../../entities/profile'
import { useAuthenticatedUser } from '../../features/auth'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { AppHeader } from '../../shared/ui/AppHeader'
import { FormField } from '../../shared/ui/FormField'

/** 공개 또는 비밀번호 오픈 책방을 만들고 바로 방으로 이동하는 화면을 렌더링한다. */
export function CreateCommunityRoomPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const profileId = useAuthenticatedUser().id
  const form = useForm<CreateCommunityRoomForm>({
    defaultValues: { access: 'public', capacity: 10, description: '', name: '', password: '' },
    resolver: zodResolver(createCommunityRoomFormSchema),
  })
  const access = useWatch({ control: form.control, name: 'access' })

  /** 현재 프로필 이름을 방장 표시 이름으로 사용해 오픈 책방을 만든다. */
  async function handleSubmit(values: CreateCommunityRoomForm) {
    const client = createSupabaseClient()
    const profile = await getProfile(client, profileId)
    const roomId = await createCommunityRoom(client, profile.displayName, values)
    await queryClient.invalidateQueries({ queryKey: communityKeys.all })
    void navigate(`/community/${roomId}`, { replace: true })
  }

  return (
    <main className="app-page bg-surface px-4 pb-8">
      <AppHeader onBack={() => void navigate('/community')} title="오픈 책방 만들기" />
      <form className="mt-8 space-y-6" onSubmit={form.handleSubmit(handleSubmit)}>
        <FormField errorMessage={form.formState.errors.name?.message} label="책방 이름" name="name">
          <TextField.Root className="talkhugam-information-field">
            <TextField.Input {...form.register('name')} placeholder="예: 밤의 독서회" />
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
              {...form.register('description')}
              placeholder="함께 읽고 싶은 이야기를 적어 주세요."
            />
          </TextField.Root>
        </FormField>
        <fieldset>
          <legend className="text-ink text-sm font-semibold">입장 방식</legend>
          <div className="mt-3 flex gap-3">
            <label className="text-sm">
              <input {...form.register('access')} type="radio" value="public" /> 바로 참여
            </label>
            <label className="text-sm">
              <input {...form.register('access')} type="radio" value="password" /> 비밀번호
            </label>
          </div>
        </fieldset>
        {access === 'password' ? (
          <FormField
            errorMessage={form.formState.errors.password?.message}
            label="비밀번호"
            name="password"
          >
            <TextField.Root className="talkhugam-information-field">
              <TextField.Input {...form.register('password')} type="password" />
            </TextField.Root>
          </FormField>
        ) : null}
        <FormField
          errorMessage={form.formState.errors.capacity?.message}
          label="정원 (1~100명)"
          name="capacity"
        >
          <TextField.Root className="talkhugam-information-field">
            <TextField.Input
              {...form.register('capacity', { valueAsNumber: true })}
              max="100"
              min="1"
              type="number"
            />
          </TextField.Root>
        </FormField>
        <ActionButton
          className="talkhugam-primary-action w-full"
          disabled={form.formState.isSubmitting}
          size="large"
          type="submit"
          variant="brandSolid"
        >
          오픈 책방 열기
        </ActionButton>
      </form>
    </main>
  )
}
