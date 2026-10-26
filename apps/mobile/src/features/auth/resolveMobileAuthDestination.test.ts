import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

import { legalDocumentVersion } from '@talkhugam/domain'

import { resolveMobileAuthDestination } from './resolveMobileAuthDestination'

/** 인증과 정책 상태를 조회하는 최소 Supabase 응답을 만든다. */
function createClient(input: {
  consents: unknown
  onboardingCompletedAt: unknown
  userId?: string | null
}): SupabaseClient {
  const profileQuery = {
    single: async () => ({
      data: { onboarding_completed_at: input.onboardingCompletedAt },
      error: null,
    }),
    then: <TResult1 = { data: unknown; error: null }, TResult2 = never>(
      onfulfilled?:
        | ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>)
        | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): Promise<TResult1 | TResult2> =>
      Promise.resolve({
        data: [{ onboarding_completed_at: input.onboardingCompletedAt }],
        error: null,
      }).then(onfulfilled, onrejected),
  }

  return {
    auth: {
      getUser: async () => ({
        data: { user: input.userId === null ? null : { id: input.userId ?? 'profile-1' } },
        error: null,
      }),
    },
    from: (table: string) => ({
      select: () => ({
        eq: () =>
          table === 'user_legal_consents'
            ? Promise.resolve({ data: input.consents, error: null })
            : profileQuery,
      }),
    }),
  } as unknown as SupabaseClient
}

describe('resolveMobileAuthDestination', () => {
  it('reads the profile with single so Supabase array rows do not reach the domain parser', async () => {
    const client = createClient({
      consents: [
        { document_type: 'terms', document_version: legalDocumentVersion },
        { document_type: 'privacy', document_version: legalDocumentVersion },
      ],
      onboardingCompletedAt: '2026-07-16T00:00:00.000Z',
    })

    await expect(resolveMobileAuthDestination(client)).resolves.toBe('/rooms')
  })

  it('sends a completed profile without current policy consent to the legal screen', async () => {
    const client = createClient({
      consents: [{ document_type: 'terms', document_version: legalDocumentVersion }],
      onboardingCompletedAt: '2026-07-16T00:00:00.000Z',
    })

    await expect(resolveMobileAuthDestination(client)).resolves.toBe('/legal-consent')
  })

  it('sends a user who consented only to the previous 2026-07-18.2 documents to the legal screen', async () => {
    const client = createClient({
      consents: [
        { document_type: 'terms', document_version: '2026-07-18.2' },
        { document_type: 'privacy', document_version: '2026-07-18.2' },
      ],
      onboardingCompletedAt: '2026-07-16T00:00:00.000Z',
    })

    await expect(resolveMobileAuthDestination(client)).resolves.toBe('/legal-consent')
  })

  it('sends a consented first-run profile to onboarding', async () => {
    const client = createClient({
      consents: [
        { document_type: 'terms', document_version: legalDocumentVersion },
        { document_type: 'privacy', document_version: legalDocumentVersion },
      ],
      onboardingCompletedAt: null,
    })

    await expect(resolveMobileAuthDestination(client)).resolves.toBe('/onboarding')
  })

  it('refuses to route when the returned consent records are malformed', async () => {
    const client = createClient({
      consents: [{ document_type: 'terms', document_version: '' }],
      onboardingCompletedAt: '2026-07-16T00:00:00.000Z',
    })

    await expect(resolveMobileAuthDestination(client)).rejects.toThrow()
  })

  it('refuses to route without an authenticated user', async () => {
    const client = createClient({
      consents: [],
      onboardingCompletedAt: null,
      userId: null,
    })

    await expect(resolveMobileAuthDestination(client)).rejects.toThrow(
      '로그인 정보를 확인하지 못했어요.',
    )
  })
})
