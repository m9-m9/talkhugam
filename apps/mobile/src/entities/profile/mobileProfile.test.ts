import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import { completeMobileOnboarding, getMobileProfile, updateMobileProfile } from './mobileProfile'

const profileId = '4493a33c-c880-4743-a03d-1dae1cd28309'

/** 인증된 사용자의 프로필 행을 반환하는 최소 Supabase 클라이언트를 만든다. */
function createClient(input?: { profileUpdateError?: Error; userId?: string | null }) {
  const eq = vi.fn(() => ({
    single: vi.fn(async () => ({
      data: {
        avatar_path: null,
        bio: '느리게 읽어요.',
        display_name: '민규',
        onboarding_completed_at: null,
        updated_at: '2026-08-18T00:00:00.000Z',
      },
      error: null,
    })),
  }))
  const select = vi.fn(() => ({ eq }))
  const updateSelect = vi.fn((columns: string) => ({
    single: vi.fn(async () => ({
      data:
        columns === 'id'
          ? { id: profileId }
          : { onboarding_completed_at: '2026-08-18T00:00:00.000Z' },
      error: columns === 'id' ? input?.profileUpdateError ?? null : null,
    })),
  }))
  const updateEq = vi.fn(() => ({ select: updateSelect }))
  const update = vi.fn(() => ({ eq: updateEq }))
  const from = vi.fn(() => ({ select, update }))
  const getUser = vi.fn(async () => ({
    data: { user: input?.userId === null ? null : { id: input?.userId ?? profileId } },
    error: null,
  }))

  return {
    client: { auth: { getUser }, from } as unknown as SupabaseClient,
    eq,
    from,
    getUser,
    select,
    update,
    updateEq,
    updateSelect,
  }
}

describe('mobileProfile', () => {
  it('reads only the authenticated member profile and maps it to a domain model', async () => {
    const { client, eq, from, getUser, select } = createClient()

    await expect(getMobileProfile(client)).resolves.toEqual({
      avatarPath: null,
      bio: '느리게 읽어요.',
      displayName: '민규',
      onboardingCompletedAt: null,
      updatedAt: '2026-08-18T00:00:00.000Z',
    })
    expect(getUser).toHaveBeenCalledOnce()
    expect(from).toHaveBeenCalledWith('profiles')
    expect(select).toHaveBeenCalledWith(
      'avatar_path, display_name, bio, onboarding_completed_at, updated_at',
    )
    expect(eq).toHaveBeenCalledWith('id', profileId)
  })

  it('rejects profile writes before querying Supabase when the user is unauthenticated', async () => {
    const { client, from } = createClient({ userId: null })

    await expect(
      completeMobileOnboarding(client, { bio: '읽습니다.', displayName: '민규' }),
    ).rejects.toThrow('로그인 정보를 확인하지 못했어요.')
    expect(from).not.toHaveBeenCalled()
  })

  it('writes normalized onboarding data only to the authenticated profile id', async () => {
    const { client, update, updateEq } = createClient()

    await completeMobileOnboarding(client, {
      bio: '  천천히 읽어요.  ',
      displayName: '  민규  ',
    })

    expect(update).toHaveBeenCalledWith({
      bio: '천천히 읽어요.',
      display_name: '민규',
      onboarding_completed_at: expect.any(String),
    })
    expect(updateEq).toHaveBeenCalledWith('id', profileId)
  })

  it('updates only the authenticated member profile without changing onboarding completion', async () => {
    const { client, update, updateEq, updateSelect } = createClient()

    await expect(
      updateMobileProfile(client, { bio: '  같이 읽을 책을 찾고 있어요.  ', displayName: '  민규  ' }),
    ).resolves.toEqual({ bio: '같이 읽을 책을 찾고 있어요.', displayName: '민규' })

    expect(update).toHaveBeenCalledWith({
      bio: '같이 읽을 책을 찾고 있어요.',
      display_name: '민규',
    })
    expect(updateEq).toHaveBeenCalledWith('id', profileId)
    expect(updateSelect).toHaveBeenCalledWith('id')
  })

  it('rejects an RLS-filtered profile update instead of treating it as a successful save', async () => {
    const updateError = new Error('The result contains 0 rows')
    const { client } = createClient({ profileUpdateError: updateError })

    await expect(
      updateMobileProfile(client, { bio: '같이 읽을 책을 찾고 있어요.', displayName: '민규' }),
    ).rejects.toThrow('The result contains 0 rows')
  })
})
