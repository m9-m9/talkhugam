import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'

import { ActionButton, TextField } from '@seed-design/react'
import { Snackbar, useSnackbarContext } from '@seed-design/react-snackbar'

import { getClientEnv } from '../../app/env'
import {
  createRoomFormSchema,
  createRoomWithInvite,
  readingRoomKeys,
  type CreatedRoomInvite,
  type CreateRoomForm,
} from '../../entities/reading-room'
import { useAuthenticatedUser } from '../../features/auth'
import {
  copyInviteText,
  createInviteShareData,
  getInviteCopyText,
  getInvitePlatformUrl,
  shareInviteWithKakao,
  type InviteSharePlatform,
} from '../../features/invite-sharing'
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
        roomName={form.getValues('name')}
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
function RoomCreatedPage({
  invite,
  onClose,
  roomName,
}: {
  invite: CreatedRoomInvite
  onClose: () => void
  roomName: string
}) {
  return (
    <Snackbar.RootProvider>
      <RoomCreatedContent invite={invite} onClose={onClose} roomName={roomName} />
    </Snackbar.RootProvider>
  )
}

/** 생성된 초대 정보를 복사하거나 채널별 공유 동작으로 전달하는 완료 내용을 렌더링한다. */
function RoomCreatedContent({
  invite,
  onClose,
  roomName,
}: {
  invite: CreatedRoomInvite
  onClose: () => void
  roomName: string
}) {
  const snackbar = useSnackbarContext()

  /** 짧은 결과 메시지를 SEED Snackbar로 화면 하단에 표시한다. */
  function showSnackbar(message: string) {
    snackbar.create({
      render: () => <p className="seed-snackbar__message">{message}</p>,
      timeout: 3000,
    })
  }

  /** 복사 초대 요청이나 사용자 동작을 처리한다. */
  async function handleCopyInvite() {
    try {
      await copyInviteText(invite.code)
      showSnackbar('초대 코드를 복사했어요.')
    } catch {
      showSnackbar('초대 코드를 복사하지 못했어요.')
    }
  }

  /** 선택한 채널에 맞춰 초대 링크와 안내 문구를 전달한다. */
  async function handleShareInvite(platform: Exclude<InviteSharePlatform, 'sms'>) {
    const shareData = createInviteShareData(window.location.origin, roomName, invite)

    try {
      if (platform === 'kakao') {
        const javascriptKey = getClientEnv().VITE_KAKAO_JAVASCRIPT_KEY
        if (javascriptKey) {
          try {
            await shareInviteWithKakao(shareData, javascriptKey)
          } catch {
            await shareWithDevice(shareData)
          }
        } else await shareWithDevice(shareData)
        showSnackbar('카카오톡에서 보낼 초대 내용을 준비했어요.')
        return
      }

      if (platform === 'instagram') {
        await copyInviteText(getInviteCopyText(shareData))
        openInvitePlatform(platform, shareData)
        showSnackbar('초대 링크를 복사했어요. 인스타그램에서 붙여 넣어 보내세요.')
        return
      }

      openInvitePlatform(platform, shareData)
      showSnackbar('페이스북 공유 창을 열었어요.')
    } catch (error) {
      if (isShareCancellation(error)) return
      showSnackbar('초대 내용을 공유하지 못했어요. 다시 시도해 주세요.')
    }
  }

  return (
    <main className="app-page bg-surface flex flex-col px-4 pb-16">
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
          초대 코드 복사하기
        </ActionButton>
        <section className="mt-8 mb-16 w-full text-left" aria-labelledby="room-invite-share-title">
          <h2 className="text-ink text-sm font-semibold" id="room-invite-share-title">
            바로 공유하기
          </h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <ActionButton
              aria-label="카카오톡으로 초대 보내기"
              className="w-full px-2 text-xs"
              onClick={() => void handleShareInvite('kakao')}
              size="medium"
              type="button"
              variant="neutralOutline"
            >
              카카오
            </ActionButton>
            <ActionButton
              aria-label="인스타그램으로 초대 보내기"
              className="w-full px-2 text-xs"
              onClick={() => void handleShareInvite('instagram')}
              size="medium"
              type="button"
              variant="neutralOutline"
            >
              인스타
            </ActionButton>
            <ActionButton
              aria-label="페이스북으로 초대 보내기"
              className="w-full px-2 text-xs"
              onClick={() => void handleShareInvite('facebook')}
              size="medium"
              type="button"
              variant="neutralOutline"
            >
              페이스북
            </ActionButton>
          </div>
        </section>
      </div>
      <Snackbar.Region className="talkhugam-bottom-navigation-snackbar seed-snackbar-region fixed">
        {snackbar.currentSnackbar ? (
          <Snackbar.Root className="seed-snackbar__root">
            <Snackbar.Renderer />
          </Snackbar.Root>
        ) : null}
      </Snackbar.Region>
    </main>
  )
}

/** 기기 공유 API가 있으면 사용하고, 없으면 초대 문구를 복사한다. */
async function shareWithDevice(shareData: {
  text: string
  title: string
  url: string
}): Promise<void> {
  if (typeof navigator.share === 'function') {
    await navigator.share(shareData)
    return
  }
  await copyInviteText(getInviteCopyText(shareData))
}

/** 브라우저에서 지원하는 채널의 공유 주소를 새 창으로 연다. */
function openInvitePlatform(
  platform: Exclude<InviteSharePlatform, 'kakao' | 'sms'>,
  shareData: { text: string; title: string; url: string },
) {
  const platformUrl = getInvitePlatformUrl(platform, shareData)
  if (platformUrl === null) return
  window.open(platformUrl, '_blank', 'noopener,noreferrer')
}

/** 기기 공유 시트에서 사용자가 취소한 오류인지 판별한다. */
function isShareCancellation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  return 'name' in error && error.name === 'AbortError'
}
