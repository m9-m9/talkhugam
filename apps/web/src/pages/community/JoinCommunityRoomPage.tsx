import { useQueryClient } from '@tanstack/react-query'
import { ActionButton, TextField } from '@seed-design/react'
import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { communityKeys, joinCommunityRoom } from '../../entities/community'
import { getProfile } from '../../entities/profile'
import { useAuthenticatedUser } from '../../features/auth'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { AppHeader } from '../../shared/ui/AppHeader'

/** 선택한 오픈 책방에 공개 또는 비밀번호 방식으로 참여하는 화면을 렌더링한다. */
export function JoinCommunityRoomPage() {
  const { roomId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const profileId = useAuthenticatedUser().id
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const requiresPassword = searchParams.get('password') === 'true'

  /** 현재 프로필 표시 이름으로 오픈 책방 참여를 요청한다. */
  async function handleJoin() {
    if (!roomId) return
    setErrorMessage(null)
    try {
      const client = createSupabaseClient()
      const profile = await getProfile(client, profileId)
      await joinCommunityRoom(client, roomId, profile.displayName, password)
      await queryClient.invalidateQueries({ queryKey: communityKeys.all })
      void navigate(`/community/${roomId}`, { replace: true })
    } catch {
      setErrorMessage(
        requiresPassword ? '비밀번호를 확인해 주세요.' : '지금은 이 책방에 참여할 수 없어요.',
      )
    }
  }

  return (
    <main className="app-page bg-surface px-4 pb-8">
      <AppHeader onBack={() => void navigate('/community')} title="오픈 책방 참여" />
      <section className="mt-12 text-center">
        <h1 className="text-ink text-xl font-bold">함께 읽기를 시작할까요?</h1>
        <p className="text-ink-subtle mt-2 text-sm">
          참여한 뒤에는 자유롭게 이야기를 나눌 수 있어요.
        </p>
      </section>
      {requiresPassword ? (
        <label className="text-ink mt-12 block text-sm font-semibold">
          비밀번호
          <TextField.Root className="talkhugam-information-field mt-2">
            <TextField.Input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </TextField.Root>
        </label>
      ) : null}
      {errorMessage ? (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <ActionButton
        className="talkhugam-primary-action mt-10 w-full"
        onClick={() => void handleJoin()}
        size="large"
        type="button"
        variant="brandSolid"
      >
        {requiresPassword ? '비밀번호로 참여하기' : '바로 참여하기'}
      </ActionButton>
    </main>
  )
}
