import { FunctionsHttpError } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import { AccountDeletionError, requestAccountDeletion } from './accountDeletion'

describe('account deletion', () => {
  it('sends the chosen deletion mode to the protected Edge Function', async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: {
        data: {
          completionPending: false,
          deleted: true,
          requestId: '22222222-2222-4222-8222-222222222222',
        },
        ok: true,
        requestId: '33333333-3333-4333-8333-333333333333',
      },
      error: null,
    })

    await expect(requestAccountDeletion({ functions: { invoke } }, 'anonymize')).resolves.toEqual({
      completionPending: false,
      deleted: true,
      requestId: '22222222-2222-4222-8222-222222222222',
    })

    expect(invoke).toHaveBeenCalledWith('account-delete', {
      body: { mode: 'anonymize' },
    })
  })

  it('keeps a pending completion as a successful account deletion result', async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: {
        data: {
          completionPending: true,
          deleted: true,
          requestId: '22222222-2222-4222-8222-222222222222',
        },
        ok: true,
        requestId: '33333333-3333-4333-8333-333333333333',
      },
      error: null,
    })

    await expect(
      requestAccountDeletion({ functions: { invoke } }, 'delete_content'),
    ).resolves.toMatchObject({
      completionPending: true,
      deleted: true,
    })
  })

  it('keeps an owner-transfer failure distinguishable for the UI', async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: null,
      error: new FunctionsHttpError(
        new Response(
          JSON.stringify({
            error: {
              code: 'OWNER_TRANSFER_REQUIRED',
              message: '먼저 다른 멤버에게 방장을 넘겨 주세요.',
            },
          }),
          { headers: { 'content-type': 'application/json' }, status: 409 },
        ),
      ),
    })

    await expect(
      requestAccountDeletion({ functions: { invoke } }, 'delete_content'),
    ).rejects.toEqual(
      new AccountDeletionError('OWNER_TRANSFER_REQUIRED', '먼저 다른 멤버에게 방장을 넘겨 주세요.'),
    )
  })
})
